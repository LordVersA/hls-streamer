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
  private frameAlignedSegments = new Map<number, { start: number; end: number }>();

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

    // For frame alignment, we need to read a bit more to find the proper start position
    const searchBufferSize = Math.min(8192, fileInfo.size); // Read up to 8KB to find frame boundary
    const searchStartByte = Math.max(0, startByte - 1024); // Start searching a bit before the target
    const searchEndByte = Math.min(fileInfo.size, startByte + searchBufferSize);

    const fd = fs.openSync(this.filePath, "r");

    try {
      // Read a search buffer to find the frame boundary
      const searchBuffer = Buffer.alloc(searchEndByte - searchStartByte);
      fs.readSync(fd, searchBuffer as any, 0, searchBuffer.length, searchStartByte);

      // Find the actual frame-aligned start position
      const targetOffsetInSearch = startByte - searchStartByte;
      const frameAlignedOffsetInSearch = this.findNextMp3Frame(searchBuffer, Math.max(0, targetOffsetInSearch));
      const actualStartByte = searchStartByte + frameAlignedOffsetInSearch;

      // Ensure we don't go beyond the requested end
      const actualEndByte = Math.min(endByte, fileInfo.size);
      const bufferLength = actualEndByte - actualStartByte;

      if (bufferLength <= 0) {
        // Fallback to original range if frame alignment fails
        const fallbackLength = endByte - startByte;
        const fallbackBuffer = Buffer.alloc(fallbackLength);
        const bytesRead = fs.readSync(fd, fallbackBuffer as any, 0, fallbackLength, startByte);
        return fallbackBuffer.subarray(0, bytesRead);
      }

      // Read the frame-aligned segment
      const buffer = Buffer.alloc(bufferLength);
      const bytesRead = fs.readSync(fd, buffer as any, 0, bufferLength, actualStartByte);
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

    // Generate segment entries with frame-aligned boundaries
    for (let i = 0; i < segmentCount; i++) {
      const { start, end } = await this.getFrameAlignedSegment(i, fileInfo.size);

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

  /**
   * Get or calculate frame-aligned segment boundaries
   */
  private async getFrameAlignedSegment(segmentIndex: number, fileSize: number): Promise<{ start: number; end: number }> {
    if (this.frameAlignedSegments.has(segmentIndex)) {
      return this.frameAlignedSegments.get(segmentIndex)!;
    }

    // Calculate initial segment boundaries
    const rawSegment = this.calculateSegment(segmentIndex, fileSize);

    // For the first segment, always start from the beginning of the first frame
    if (segmentIndex === 0) {
      const fd = fs.openSync(this.filePath, "r");
      try {
        const headerBuffer = Buffer.alloc(Math.min(8192, fileSize));
        fs.readSync(fd, headerBuffer as any, 0, headerBuffer.length, 0);
        const frameStart = this.findNextMp3Frame(headerBuffer, 0);
        const alignedSegment = { start: frameStart, end: rawSegment.end };
        this.frameAlignedSegments.set(segmentIndex, alignedSegment);
        return alignedSegment;
      } finally {
        fs.closeSync(fd);
      }
    }

    // For other segments, use the raw calculation (frame alignment will be handled in getFileBuffer)
    this.frameAlignedSegments.set(segmentIndex, rawSegment);
    return rawSegment;
  }

  /**
   * Find the next MP3 frame sync starting from the given position
   */
  private findNextMp3Frame(buffer: Buffer, startPos: number): number {
    // Skip ID3v2 tag if we're at the beginning
    let pos = startPos;
    if (pos === 0 && buffer.length > 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
      const tagSize = ((buffer[6]! & 0x7f) << 21) |
                     ((buffer[7]! & 0x7f) << 14) |
                     ((buffer[8]! & 0x7f) << 7) |
                     (buffer[9]! & 0x7f);
      pos = 10 + tagSize;
    }

    // Look for MP3 frame sync (0xFF followed by 0xE0-0xFF)
    while (pos < buffer.length - 1) {
      if (buffer[pos] === 0xFF && (buffer[pos + 1]! & 0xE0) === 0xE0) {
        // Found potential frame sync, validate it's a real MP3 header
        if (pos + 3 < buffer.length) {
          const header = (buffer[pos]! << 24) |
                        (buffer[pos + 1]! << 16) |
                        (buffer[pos + 2]! << 8) |
                        buffer[pos + 3]!;

          const version = (header >> 19) & 0x3;
          const layer = (header >> 17) & 0x3;
          const bitrateIndex = (header >> 12) & 0xF;
          const sampleRateIndex = (header >> 10) & 0x3;

          // Validate header fields
          if (version !== 1 && layer !== 0 && bitrateIndex !== 0 &&
              bitrateIndex !== 15 && sampleRateIndex !== 3) {
            return pos;
          }
        }
      }
      pos++;
    }

    // If no frame found, return the original position
    return startPos;
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
