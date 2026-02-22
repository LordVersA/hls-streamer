import fs from "node:fs";
import path from "node:path";
import { HlsStreamerOptions, SegmentInfo, AudioFileInfo } from "./Interfaces/HlsStreamer";
import { FileLib } from "./Libs/FileLib";
import { FormatDetector } from "./Libs/FormatDetector";
import {
  FileNotFoundError,
  InvalidFileError,
  InvalidRangeError,
  InvalidParameterError,
  UnsupportedFormatError
} from "./errors/HlsStreamerErrors";

/**
 * HLS streaming implementation for audio files without temporary file storage
 * Supports: MP3, AAC, M4A, OGG Vorbis, FLAC, WAV
 */
export class HlsStreamer {
  private readonly filePath: string;
  private readonly segmentSize: number;
  private readonly fileName: string;
  private readonly baseUrl: string;
  private readonly enableFastStart: boolean;
  private readonly formatOverride: string | undefined;
  private fileInfo?: AudioFileInfo;
  private segments: SegmentInfo[] | undefined;

  /**
   * Initialize HLS streamer with audio file and configuration
   */
  constructor(options: HlsStreamerOptions) {
    this.validateOptions(options);
    this.validateFile(options.filePath, options.format);

    this.filePath = options.filePath;
    this.segmentSize = (options.segmentSizeKB ?? 512) * 1024;
    this.fileName = options.fileName ?? "file";
    this.baseUrl = options.baseUrl ?? "";
    this.enableFastStart = options.enableFastStart ?? false;
    this.formatOverride = options.format || undefined;
  }

  private validateOptions(options: HlsStreamerOptions): void {
    if (!options.filePath || typeof options.filePath !== 'string') {
      throw new InvalidParameterError('filePath', options.filePath);
    }

    if (options.segmentSizeKB !== undefined &&
        (typeof options.segmentSizeKB !== 'number' || options.segmentSizeKB <= 0)) {
      throw new InvalidParameterError('segmentSizeKB', options.segmentSizeKB);
    }

    if (options.fileName !== undefined && typeof options.fileName !== 'string') {
      throw new InvalidParameterError('fileName', options.fileName);
    }
  }

  private validateFile(filePath: string, format?: string): void {
    if (!fs.existsSync(filePath)) {
      throw new FileNotFoundError(filePath);
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new InvalidFileError('Path is not a file');
    }

    // If format is specified, validate it
    if (format) {
      const supportedFormats = ['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav'];
      if (!supportedFormats.includes(format.toLowerCase())) {
        throw new UnsupportedFormatError(format);
      }
    } else {
      // Prefer fast extension validation, but allow extensionless or mislabeled files
      // when their magic bytes are a supported audio format.
      if (!FormatDetector.isSupportedExtension(filePath)) {
        const fd = fs.openSync(filePath, 'r');
        try {
          const header = new Uint8Array(64);
          const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
          const detectedFormat = FormatDetector.detectFormat(Buffer.from(header.subarray(0, bytesRead)));
          if (!detectedFormat) {
            const ext = path.extname(filePath);
            throw new UnsupportedFormatError(ext || 'unknown');
          }
        } finally {
          fs.closeSync(fd);
        }
      }
    }
  }

  private async getFileInfo(): Promise<AudioFileInfo> {
    if (!this.fileInfo) {
      const analysis = await FileLib.analyzeAudioFile(this.filePath, this.formatOverride as any);

      if (analysis.size <= 0) {
        throw new InvalidFileError('File is empty');
      }

      this.fileInfo = analysis;
      this.segments = undefined;
    }

    return this.fileInfo;
  }

  /**
   * Read file bytes within specified range
   */
  async getFileBuffer(startByte: number, endByte: number): Promise<Buffer> {
    if (isNaN(startByte) || isNaN(endByte) || startByte < 0 || endByte < startByte) {
      throw new InvalidRangeError(startByte, endByte);
    }

    const fileInfo = await this.getFileInfo();
    if (endByte > fileInfo.size) {
      throw new InvalidRangeError(startByte, endByte);
    }
    const length = endByte - startByte;
    const fd = fs.openSync(this.filePath, "r");

    try {
      if (length === 0) {
        return Buffer.alloc(0);
      }

      const buffer = Buffer.alloc(length);
      const bytesRead = fs.readSync(fd, buffer as any, 0, length, startByte);
      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Generate HLS M3U8 playlist for the MP3 file
   */
  async createM3U8(): Promise<string> {
    const [fileInfo, segments] = await Promise.all([
      this.getFileInfo(),
      this.getSegments()
    ]);

    if (!segments.length) {
      throw new InvalidFileError('Unable to generate segments for MP3 file');
    }

    const maxSegmentDuration = segments.reduce((max, segment) => Math.max(max, segment.duration), 0);
    const targetDurationSeconds = Math.max(1, Math.ceil(maxSegmentDuration || fileInfo.duration || 1));

    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `#EXT-X-TARGETDURATION:${targetDurationSeconds}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
    ];

    segments.forEach((segment, index) => {
      const segmentUrl = this.buildSegmentUrl(segment.start, segment.end, index);
      m3u8.push(`#EXTINF:${segment.duration.toFixed(3)},`);
      m3u8.push(segmentUrl);
    });

    m3u8.push('#EXT-X-ENDLIST');
    return m3u8.join('\n');
  }

  private async getSegments(): Promise<SegmentInfo[]> {
    if (this.segments) {
      return this.segments;
    }

    const fileInfo = await this.getFileInfo();

    if (!fileInfo.frames.length) {
      this.segments = this.buildSegmentsWithoutFrameTable(fileInfo);
      return this.segments;
    }

    const targetSizes = this.computeTargetSizes(fileInfo);
    const segments: SegmentInfo[] = [];
    const frames = fileInfo.frames;

    let frameCursor = 0;

    const consumeFrames = (targetBytes: number) => {
      if (frameCursor >= frames.length) {
        return;
      }

      const startFrameIndex = frameCursor;
      let consumedBytes = 0;
      let duration = 0;

      while (frameCursor < frames.length) {
        const frame = frames[frameCursor]!;
        const nextBytes = consumedBytes + frame.length;

        if (consumedBytes > 0 && nextBytes > targetBytes) {
          break;
        }

        consumedBytes = nextBytes;
        duration += frame.duration;
        frameCursor++;

        if (consumedBytes >= targetBytes) {
          break;
        }
      }

      if (frameCursor === startFrameIndex && frameCursor < frames.length) {
        const frame = frames[frameCursor]!;
        consumedBytes += frame.length;
        duration += frame.duration;
        frameCursor++;
      }

      if (frameCursor === startFrameIndex) {
        return;
      }

      const start = frames[startFrameIndex]!.offset;
      const lastFrame = frames[frameCursor - 1]!;
      const end = lastFrame.offset + lastFrame.length;

      segments.push({
        start,
        end,
        duration
      });
    };

    targetSizes.forEach(consumeFrames);

    while (frameCursor < frames.length) {
      consumeFrames(this.segmentSize);
    }

    if (!segments.length) {
      this.segments = this.buildSegmentsWithoutFrameTable(fileInfo);
    } else {
      this.segments = segments;
    }

    return this.segments;
  }

  private computeTargetSizes(fileInfo: AudioFileInfo): number[] {
    const totalBytes = fileInfo.audioDataSize || fileInfo.size;
    return this.computeTargetSizesFromBytes(totalBytes);
  }

  private computeTargetSizesFromBytes(totalBytes: number): number[] {
    if (totalBytes <= 0) {
      return [];
    }

    const targets: number[] = [];
    let remaining = totalBytes;
    let index = 0;

    while (remaining > 0) {
      const targetSize = Math.min(this.calculateSegmentSize(index), remaining);
      targets.push(targetSize);
      remaining -= targetSize;
      index++;
    }

    return targets.length ? targets : [totalBytes];
  }

  private buildSegmentsWithoutFrameTable(fileInfo: AudioFileInfo): SegmentInfo[] {
    const segments: SegmentInfo[] = [];
    const totalBytes = Math.max(fileInfo.size, fileInfo.audioDataSize);

    if (totalBytes <= 0) {
      return segments;
    }

    const targets = this.computeTargetSizesFromBytes(totalBytes);
    let start = 0;

    targets.forEach((targetSize) => {
      const end = Math.min(totalBytes, start + targetSize);
      const duration = this.estimateSegmentDuration(end - start, fileInfo);
      segments.push({ start, end, duration });
      start = end;
    });

    if (start < totalBytes) {
      const duration = this.estimateSegmentDuration(totalBytes - start, fileInfo);
      segments.push({ start, end: totalBytes, duration });
    }

    return segments;
  }

  private estimateSegmentDuration(segmentSize: number, fileInfo: AudioFileInfo): number {
    // Use file info to make better duration estimate if available
    if (fileInfo.duration > 0 && fileInfo.audioDataSize > 0) {
      const bytesPerSecond = fileInfo.audioDataSize / fileInfo.duration;
      return segmentSize / bytesPerSecond;
    }

    // Fallback: rough estimate based on average bitrate or assume 128kbps
    const estimatedBytesPerSecond = fileInfo.averageBitrate
      ? (fileInfo.averageBitrate * 1000) / 8
      : 16000; // 128kbps default

    return segmentSize / estimatedBytesPerSecond;
  }

  private buildSegmentUrl(start: number, end: number, index: number): string {
    const baseUrlPrefix = this.baseUrl ? `/${this.baseUrl}` : '';
    // Use the detected format from fileInfo, or fall back to file extension
    const ext = this.fileInfo?.format || path.extname(this.filePath).toLowerCase().slice(1) || 'mp3';
    return `${baseUrlPrefix}/${start}/${end}/${this.fileName}${this.padNumber(index, 3)}.${ext}`;
  }

  private calculateSegmentSize(segmentIndex: number): number {
    if (!this.enableFastStart) {
      return this.segmentSize;
    }

    switch (segmentIndex) {
      case 0:
        return this.segmentSize / 4;
      case 1:
        return this.segmentSize / 2;
      default:
        return this.segmentSize;
    }
  }


  private padNumber(value: number, padding: number): string {
    return value.toString().padStart(padding, '0');
  }

  /**
   * Get accurate duration for a specific segment
   */
  async getSegmentDuration(segmentIndex: number): Promise<number> {
    if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
      throw new InvalidParameterError('segmentIndex', segmentIndex);
    }

    const segments = await this.getSegments();
    const segment = segments[segmentIndex];

    if (!segment) {
      throw new InvalidParameterError('segmentIndex', segmentIndex);
    }

    return segment.duration;
  }
}

// Export interfaces and errors for consumers
export * from './Interfaces/HlsStreamer';
export * from './errors/HlsStreamerErrors';
