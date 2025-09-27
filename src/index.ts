import fs from "node:fs";
import path from "node:path";
import { HlsStreamerOptions, SegmentInfo, Mp3FileInfo } from "./Interfaces/HlsStreamer";
import { FileLib } from "./Libs/FileLib";
import {
  FileNotFoundError,
  InvalidFileError,
  InvalidRangeError,
  InvalidParameterError
} from "./errors/HlsStreamerErrors";

/**
 * HLS streaming implementation for MP3 files without temporary file storage
 */
export class HlsStreamer {
  private readonly filePath: string;
  private readonly segmentSize: number;
  private readonly fileName: string;
  private readonly baseUrl: string;
  private readonly enableFastStart: boolean;
  private fileInfo?: Mp3FileInfo;
  private segmentCache = new Map<number, SegmentInfo>();

  /**
   * Initialize HLS streamer with MP3 file and configuration
   */
  constructor(options: HlsStreamerOptions) {
    this.validateOptions(options);
    this.validateFile(options.filePath);

    this.filePath = options.filePath;
    this.segmentSize = (options.segmentSizeKB ?? 512) * 1024;
    this.fileName = options.fileName ?? "file";
    this.baseUrl = options.baseUrl ?? "";
    this.enableFastStart = options.enableFastStart ?? false;
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

  private validateFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new FileNotFoundError(filePath);
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new InvalidFileError('Path is not a file');
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.mp3') {
      throw new InvalidFileError('Only MP3 files are supported');
    }
  }

  private async getFileInfo(): Promise<Mp3FileInfo> {
    if (!this.fileInfo) {
      const stat = await fs.promises.stat(this.filePath);
      const size = stat.size;

      if (size <= 0) {
        throw new InvalidFileError('File is empty');
      }

      if (this.segmentSize > size) {
        throw new InvalidFileError('Segment size is larger than file size');
      }

      // For duration, we could read a small buffer to get MP3 header info
      // For now, we'll calculate it when needed
      this.fileInfo = {
        size,
        duration: 0 // Will be calculated when needed
      };
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

    const bufferLength = endByte - startByte;
    const fd = fs.openSync(this.filePath, "r");

    try {
      const buffer = Buffer.alloc(bufferLength);
      const bytesRead = fs.readSync(fd, buffer as any, 0, bufferLength, startByte);
      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Generate HLS M3U8 playlist for the MP3 file
   */
  async createM3U8(): Promise<string> {
    const fileInfo = await this.getFileInfo();
    const segmentCount = this.calculateSegmentCount(fileInfo.size);

    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      '#EXT-X-TARGETDURATION:14',
      '#EXT-X-MEDIA-SEQUENCE:0',
    ];

    // Generate segment entries without calculating durations upfront
    for (let i = 0; i < segmentCount; i++) {
      const { start, end } = this.calculateSegment(i, fileInfo.size);

      // Use estimated duration for now (can be made more accurate later)
      const estimatedDuration = this.estimateSegmentDuration(end - start);

      const segmentUrl = this.buildSegmentUrl(start, end, i);

      m3u8.push(`#EXTINF:${estimatedDuration.toFixed(3)}`);
      m3u8.push(segmentUrl);
    }

    m3u8.push('#EXT-X-ENDLIST');
    return m3u8.join('\n');
  }

  private calculateSegmentCount(fileSize: number): number {
    if (!this.enableFastStart) {
      return Math.ceil(fileSize / this.segmentSize);
    }

    // When fast start is enabled, first 2 segments are smaller
    const firstTwoSegmentsSize = this.calculatefirst2SegmentSize();
    const remainingSize = fileSize - firstTwoSegmentsSize;
    return Math.ceil(remainingSize / this.segmentSize) + 2;
  }

  private estimateSegmentDuration(segmentSize: number): number {
    // Rough estimate: 128kbps MP3 = ~128000 bits/second = 16000 bytes/second
    // This is just an estimate - real duration would require parsing MP3 headers
    const estimatedBytesPerSecond = 16000;
    return segmentSize / estimatedBytesPerSecond;
  }

  private buildSegmentUrl(start: number, end: number, index: number): string {
    const baseUrlPrefix = this.baseUrl ? `/${this.baseUrl}` : '';
    return `${baseUrlPrefix}/${start}/${end}/${this.fileName}${this.padNumber(index, 3)}.mp3`;
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

  private calculateSegment(segmentIndex: number, fileSize: number): { start: number; end: number } {
    let start = 0;

    if (this.enableFastStart && segmentIndex < 2) {
      // First two segments are smaller for fast start
      start = segmentIndex * (this.segmentSize / 4);
    } else if (this.enableFastStart) {
      // After first two segments, use full segment size
      start = (3 * this.segmentSize) / 4 + (segmentIndex - 2) * this.segmentSize;
    } else {
      // Normal segmentation
      start = segmentIndex * this.segmentSize;
    }

    const segmentSize = this.calculateSegmentSize(segmentIndex);
    const end = Math.min(start + segmentSize, fileSize);

    return { start: Math.floor(start), end: Math.floor(end) };
  }

  private calculatefirst2SegmentSize(): number {
    return (this.segmentSize / 4) * 3;
  }

  private padNumber(value: number, padding: number): string {
    return value.toString().padStart(padding, '0');
  }

  /**
   * Get accurate duration for a specific segment
   */
  async getSegmentDuration(segmentIndex: number): Promise<number> {
    const cachedSegment = this.segmentCache.get(segmentIndex);
    if (cachedSegment) {
      return cachedSegment.duration;
    }

    const fileInfo = await this.getFileInfo();
    const { start, end } = this.calculateSegment(segmentIndex, fileInfo.size);
    const segmentBuffer = await this.getFileBuffer(start, end);
    const duration = await FileLib.getMP3DurationFromBuffer(segmentBuffer);

    // Cache the segment info
    this.segmentCache.set(segmentIndex, {
      start,
      end,
      duration
    });

    return duration;
  }
}

// Export interfaces and errors for consumers
export * from './Interfaces/HlsStreamer';
export * from './errors/HlsStreamerErrors';
