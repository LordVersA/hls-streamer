import { HlsStreamerOptions, SegmentInfo, MediaFileInfo } from "./Interfaces/HlsStreamer";
import { IStorageProvider } from "./Interfaces/IStorageProvider";
import { LocalFileProvider } from "./Providers/LocalFileProvider";
import { FileLib } from "./Libs/FileLib";
import { FormatDetector } from "./Libs/FormatDetector";
import {
  InvalidFileError,
  InvalidRangeError,
  InvalidParameterError,
  UnsupportedFormatError
} from "./errors/HlsStreamerErrors";

/**
 * HLS streaming implementation for audio/video files without temporary file storage.
 * Supports: MP3, AAC, M4A, OGG Vorbis, FLAC, WAV, MP4, MOV, M4V
 */
export class HlsStreamer {
  private readonly provider: IStorageProvider;
  private readonly segmentSize: number;
  private readonly fileName: string;
  private readonly baseUrl: string;
  private readonly enableFastStart: boolean;
  private readonly formatOverride: string | undefined;
  private fileInfo?: MediaFileInfo;
  private segments: SegmentInfo[] | undefined;

  constructor(options: HlsStreamerOptions) {
    this.validateOptions(options);

    if (options.storageProvider) {
      this.provider = options.storageProvider;
      this.provider.validateSync?.();
    } else {
      const local = new LocalFileProvider(options.filePath);
      local.validateSync();
      this.validateFormat(options.filePath, options.format);
      this.provider = local;
    }

    this.segmentSize = (options.segmentSizeKB ?? 512) * 1024;
    this.fileName = options.fileName ?? "file";
    this.baseUrl = options.baseUrl ?? "";
    this.enableFastStart = options.enableFastStart ?? false;
    this.formatOverride = options.format || undefined;
  }

  private validateOptions(options: HlsStreamerOptions): void {
    const hasFilePath = 'filePath' in options && !!options.filePath && typeof options.filePath === 'string';
    const hasProvider = 'storageProvider' in options && !!options.storageProvider;

    if (!hasFilePath && !hasProvider) {
      throw new InvalidParameterError('filePath or storageProvider', (options as any).filePath ?? undefined);
    }

    if (options.segmentSizeKB !== undefined &&
        (typeof options.segmentSizeKB !== 'number' || options.segmentSizeKB <= 0)) {
      throw new InvalidParameterError('segmentSizeKB', options.segmentSizeKB);
    }

    if (options.fileName !== undefined && typeof options.fileName !== 'string') {
      throw new InvalidParameterError('fileName', options.fileName);
    }
  }

  private validateFormat(filePath: string, format?: string): void {
    if (format) {
      const supportedFormats = ['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav', 'mp4', 'mov', 'm4v'];
      if (!supportedFormats.includes(format.toLowerCase())) {
        throw new UnsupportedFormatError(format);
      }
    } else if (!FormatDetector.isSupportedExtension(filePath)) {
      // For extensionless/mislabeled local files, read magic bytes synchronously
      const fs = require('node:fs');
      const path = require('node:path');
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

  private async getFileInfo(): Promise<MediaFileInfo> {
    if (!this.fileInfo) {
      const [buffer, size] = await Promise.all([
        this.provider.getBuffer(),
        this.provider.getSize(),
      ]);

      let analysis;
      try {
        analysis = FileLib.analyzeMediaBuffer(buffer, {
          fileSize: size,
          format: this.formatOverride as any,
        });
      } catch {
        throw new InvalidFileError('File is empty or format could not be detected');
      }

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

    return this.provider.getRange(startByte, endByte);
  }

  /**
   * Generate HLS M3U8 playlist for the media file
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

    const isVideo = !!fileInfo.initSegment;
    const m3u8 = [
      '#EXTM3U',
      `#EXT-X-VERSION:${isVideo ? 7 : 6}`,
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `#EXT-X-TARGETDURATION:${targetDurationSeconds}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
    ];

    if (isVideo && fileInfo.initSegment) {
      const { offset, length } = fileInfo.initSegment;
      const initUrl = this.buildSegmentUrl(offset, offset + length, -1, 'init');
      m3u8.push(`#EXT-X-MAP:URI="${initUrl}"`);
    }

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

        // For video: break at keyframe boundary when we've accumulated enough bytes
        if (consumedBytes > 0 && frame.keyFrame === true && consumedBytes >= targetBytes * 0.5) {
          break;
        }

        if (consumedBytes > 0 && nextBytes > targetBytes && frame.keyFrame !== true) {
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

  private computeTargetSizes(fileInfo: MediaFileInfo): number[] {
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

  private buildSegmentsWithoutFrameTable(fileInfo: MediaFileInfo): SegmentInfo[] {
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

  private estimateSegmentDuration(segmentSize: number, fileInfo: MediaFileInfo): number {
    if (fileInfo.duration > 0 && fileInfo.audioDataSize > 0) {
      const bytesPerSecond = fileInfo.audioDataSize / fileInfo.duration;
      return segmentSize / bytesPerSecond;
    }

    const estimatedBytesPerSecond = fileInfo.averageBitrate
      ? (fileInfo.averageBitrate * 1000) / 8
      : 16000;

    return segmentSize / estimatedBytesPerSecond;
  }

  private buildSegmentUrl(start: number, end: number, index: number, nameSuffix?: string): string {
    const baseUrlPrefix = this.baseUrl ? `/${this.baseUrl}` : '';
    const ext = this.fileInfo?.format ?? this.formatOverride ?? 'mp3';
    const name = nameSuffix !== undefined ? `${this.fileName}${nameSuffix}` : `${this.fileName}${this.padNumber(index, 3)}`;
    return `${baseUrlPrefix}/${start}/${end}/${name}.${ext}`;
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
   * Returns 'video' for MP4/MOV/M4V files, 'audio' for all other formats.
   */
  async getMediaType(): Promise<'audio' | 'video'> {
    const fileInfo = await this.getFileInfo();
    const videoFormats: string[] = ['mp4', 'mov', 'm4v'];
    return videoFormats.includes(fileInfo.format) ? 'video' : 'audio';
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
export { LocalFileProvider } from './Providers/LocalFileProvider';
export { S3Provider } from './Providers/S3Provider';
export type { S3ProviderOptions } from './Providers/S3Provider';
