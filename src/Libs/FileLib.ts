import fs from 'node:fs';
import { Mp3FileInfo, Mp3FrameInfo, MediaFileInfo } from '../Interfaces/HlsStreamer';
import { ParserFactory } from '../Parsers/ParserFactory';
import { MediaFormat } from '../Parsers/IMediaParser';
import { Mp3Parser } from '../Parsers/Mp3Parser';

/**
 * File utility functions
 */
export class FileLib {
  /**
   * Get buffer size in bytes
   */
  static getFileSizeInBytes(buffer: Buffer): number {
    if (Buffer.isBuffer(buffer)) {
      return buffer.length;
    } else {
      throw new Error("Input is not a buffer");
    }
  }

  /**
   * Extract MP3 duration from buffer data (zero dependency implementation)
   */
  static async getMP3DurationFromBuffer(mp3Buffer: Buffer): Promise<number> {
    const { duration } = this.analyzeMP3Buffer(mp3Buffer);
    return duration;
  }

  /**
   * Parse MP3 buffer returning detailed metadata
   */
  static analyzeMP3Buffer(buffer: Buffer, opts: { fileSize?: number } = {}): Mp3FileInfo {
    const parsed = new Mp3Parser().analyze(buffer, opts);
    const frames: Mp3FrameInfo[] = parsed.frames.map((frame) => ({
      index: frame.index,
      offset: frame.offset,
      length: frame.length,
      duration: frame.duration,
      samples: frame.samples,
      sampleRate: frame.sampleRate,
      bitrate: frame.bitrate,
      padding: (((buffer[frame.offset + 2] ?? 0) >> 1) & 0x1) as 0 | 1
    }));

    const metadata: Mp3FileInfo = {
      size: parsed.size,
      duration: parsed.duration,
      audioDataSize: parsed.audioDataSize,
      frames
    };

    if (parsed.sampleRate !== undefined) {
      metadata.sampleRate = parsed.sampleRate;
    }

    if (parsed.averageBitrate !== undefined) {
      metadata.averageBitrate = parsed.averageBitrate;
    }

    const id3v2Size = parsed.metadata?.['id3v2Size'];
    if (typeof id3v2Size === 'number' && id3v2Size > 0) {
      metadata.id3v2Size = id3v2Size;
    }

    const id3v1Size = parsed.metadata?.['id3v1Size'];
    if (typeof id3v1Size === 'number' && id3v1Size > 0) {
      metadata.id3v1Size = id3v1Size;
    }

    if (parsed.warnings?.length) {
      metadata.warnings = parsed.warnings;
    }

    return metadata;
  }

  /**
   * Load MP3 file from disk and return metadata
   * @deprecated Use analyzeAudioFile instead
   */
  static async analyzeMP3File(filePath: string): Promise<Mp3FileInfo> {
    const [buffer, stat] = await Promise.all([
      fs.promises.readFile(filePath),
      fs.promises.stat(filePath)
    ]);

    return this.analyzeMP3Buffer(buffer, { fileSize: stat.size });
  }

  /**
   * Analyze media file (supports all audio and video formats)
   * @param filePath Path to media file
   * @param format Optional format override (auto-detected if not provided)
   * @returns Media file metadata
   */
  static async analyzeMediaFile(filePath: string, format?: MediaFormat): Promise<MediaFileInfo> {
    const [buffer, stat] = await Promise.all([
      fs.promises.readFile(filePath),
      fs.promises.stat(filePath)
    ]);

    const opts: { fileSize: number; filePath: string; format?: MediaFormat } = {
      fileSize: stat.size,
      filePath
    };

    if (format !== undefined) {
      opts.format = format;
    }

    return this.analyzeMediaBuffer(buffer, opts);
  }

  /** @deprecated Use analyzeMediaFile instead */
  static async analyzeAudioFile(filePath: string, format?: MediaFormat): Promise<MediaFileInfo> {
    return this.analyzeMediaFile(filePath, format);
  }

  /**
   * Analyze media buffer (supports all audio and video formats)
   * @param buffer Media file buffer
   * @param opts Options including fileSize, filePath for format detection, and format override
   * @returns Media file metadata
   */
  static analyzeMediaBuffer(
    buffer: Buffer,
    opts: { fileSize?: number; filePath?: string; format?: MediaFormat } = {}
  ): MediaFileInfo {
    let parser;

    // Try format override first
    if (opts.format) {
      parser = ParserFactory.getParser(opts.format);
      if (!parser) {
        throw new Error(`Unsupported format: ${opts.format}`);
      }
    }

    // Try detection from file path
    if (!parser && opts.filePath) {
      parser = ParserFactory.getParserByExtension(opts.filePath);
    }

    // Try detection from buffer content
    if (!parser) {
      parser = ParserFactory.detectParser(buffer);
    }

    if (!parser) {
      throw new Error('Could not detect audio format');
    }

    const analyzeOpts = opts.fileSize !== undefined ? { fileSize: opts.fileSize } : {};
    return parser.analyze(buffer, analyzeOpts);
  }

  /** @deprecated Use analyzeMediaBuffer instead */
  static analyzeAudioBuffer(
    buffer: Buffer,
    opts: { fileSize?: number; filePath?: string; format?: MediaFormat } = {}
  ): MediaFileInfo {
    return this.analyzeMediaBuffer(buffer, opts);
  }
}
