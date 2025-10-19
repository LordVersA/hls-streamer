import fs from 'node:fs';
import { Mp3FileInfo, Mp3FrameInfo, AudioFileInfo } from '../Interfaces/HlsStreamer';
import { ParserFactory } from '../Parsers/ParserFactory';
import { FormatDetector } from './FormatDetector';
import { AudioFormat } from '../Parsers/IAudioParser';

interface Id3Offsets {
  startOffset: number;
  id3v2Size: number;
  audioEnd: number;
  id3v1Size: number;
}

interface ParsedFrameHeader {
  version: 1 | 2 | 25;
  layer: 1 | 2 | 3;
  bitrate: number;
  sampleRate: number;
  padding: 0 | 1;
  samplesPerFrame: number;
}

/**
 * File utility functions
 */
export class FileLib {
  private static readonly BITRATE_INDEX: Record<1 | 2 | 25, Record<1 | 2 | 3, number[]>> = {
    1: {
      1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
      2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
      3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    },
    2: {
      1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
      3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
    },
    25: {
      1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
      3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
    }
  };

  private static readonly SAMPLE_RATE_INDEX: Record<1 | 2 | 25, number[]> = {
    1: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    25: [11025, 12000, 8000]
  };

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
    const warnings: string[] = [];
    const size = opts.fileSize ?? buffer.length;

    if (buffer.length === 0) {
      return {
        size,
        duration: 0,
        audioDataSize: 0,
        frames: []
      };
    }

    const offsets = this.getId3Offsets(buffer);
    const frames: Mp3FrameInfo[] = [];
    const payloadSize = Math.max(0, offsets.audioEnd - offsets.startOffset);

    let offset = offsets.startOffset;
    let frameIndex = 0;
    let sampleRate: number | undefined;
    let totalDuration = 0;
    let totalAudioBytes = 0;

    while (offset + 4 <= offsets.audioEnd) {
      if (!this.isFrameSync(buffer, offset)) {
        offset++;
        continue;
      }

      const header = buffer.readUInt32BE(offset);
      const parsed = this.parseFrameHeader(header);

      if (!parsed) {
        offset++;
        continue;
      }

      const frameLength = this.calculateFrameLength(parsed);

      if (frameLength <= 0) {
        warnings.push(`Encountered zero-length frame at offset ${offset}`);
        offset++;
        continue;
      }

      // Guard against truncated final frame
      if (offset + frameLength > buffer.length) {
        warnings.push(`Truncated frame at offset ${offset}`);
        break;
      }

      sampleRate = sampleRate ?? parsed.sampleRate;

      const frameDuration = parsed.samplesPerFrame / parsed.sampleRate;

      frames.push({
        index: frameIndex,
        offset,
        length: frameLength,
        duration: frameDuration,
        samples: parsed.samplesPerFrame,
        sampleRate: parsed.sampleRate,
        bitrate: parsed.bitrate,
        padding: parsed.padding
      });

      frameIndex++;
      totalDuration += frameDuration;
      totalAudioBytes += frameLength;
      offset += frameLength;
    }

    if (frames.length === 0) {
      const estimatedDuration = buffer.length / 16000; // ~128kbps = 16000 bytes/sec
      warnings.push('Falling back to heuristic duration due to missing MP3 frames');
      const metadata: Mp3FileInfo = {
        size,
        duration: Math.max(0.001, estimatedDuration),
        audioDataSize: payloadSize,
        frames: []
      };

      if (warnings.length) {
        metadata.warnings = warnings;
      }

      return metadata;
    }

    const duration = totalDuration;
    const averageBitrate = duration > 0 ? (totalAudioBytes * 8) / duration / 1000 : undefined;

    const metadata: Mp3FileInfo = {
      size,
      duration,
      audioDataSize: totalAudioBytes || payloadSize,
      frames
    };

    if (sampleRate !== undefined) {
      metadata.sampleRate = sampleRate;
    }

    if (averageBitrate !== undefined) {
      metadata.averageBitrate = averageBitrate;
    }

    if (offsets.id3v2Size > 0) {
      metadata.id3v2Size = offsets.id3v2Size;
    }

    if (offsets.id3v1Size > 0) {
      metadata.id3v1Size = offsets.id3v1Size;
    }

    if (warnings.length) {
      metadata.warnings = warnings;
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
   * Analyze audio file (supports all formats)
   * @param filePath Path to audio file
   * @param format Optional format override (auto-detected if not provided)
   * @returns Audio file metadata
   */
  static async analyzeAudioFile(filePath: string, format?: AudioFormat): Promise<AudioFileInfo> {
    const [buffer, stat] = await Promise.all([
      fs.promises.readFile(filePath),
      fs.promises.stat(filePath)
    ]);

    const opts: { fileSize: number; filePath: string; format?: AudioFormat } = {
      fileSize: stat.size,
      filePath
    };

    if (format !== undefined) {
      opts.format = format;
    }

    return this.analyzeAudioBuffer(buffer, opts);
  }

  /**
   * Analyze audio buffer (supports all formats)
   * @param buffer Audio file buffer
   * @param opts Options including fileSize, filePath for format detection, and format override
   * @returns Audio file metadata
   */
  static analyzeAudioBuffer(
    buffer: Buffer,
    opts: { fileSize?: number; filePath?: string; format?: AudioFormat } = {}
  ): AudioFileInfo {
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

  private static calculateFrameLength(frame: ParsedFrameHeader): number {
    if (frame.layer === 1) {
      return Math.floor(((12 * frame.bitrate * 1000) / frame.sampleRate + frame.padding) * 4);
    }

    const multiplier = frame.layer === 3 && frame.version !== 1 ? 72 : 144;
    return Math.floor((multiplier * frame.bitrate * 1000) / frame.sampleRate + frame.padding);
  }

  private static getId3Offsets(buffer: Buffer): Id3Offsets {
    let startOffset = 0;
    let id3v2Size = 0;

    if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
      const sizeBytes = buffer.subarray(6, 10);
      id3v2Size = this.syncSafeInteger(sizeBytes);
      startOffset = Math.min(buffer.length, 10 + id3v2Size);
    }

    // Detect ID3v1 tag at end (128 bytes starting with 'TAG')
    let id3v1Size = 0;
    let audioEnd = buffer.length;

    if (buffer.length >= 128) {
      const tagOffset = buffer.length - 128;
      if (buffer.toString('ascii', tagOffset, tagOffset + 3) === 'TAG') {
        id3v1Size = 128;
        audioEnd = tagOffset;
      }
    }

    return {
      startOffset,
      id3v2Size,
      audioEnd,
      id3v1Size
    };
  }

  private static syncSafeInteger(bytes: Buffer): number {
    return ((bytes[0]! & 0x7f) << 21) |
           ((bytes[1]! & 0x7f) << 14) |
           ((bytes[2]! & 0x7f) << 7) |
           (bytes[3]! & 0x7f);
  }

  private static isFrameSync(buffer: Buffer, offset: number): boolean {
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];

    if (byte1 === undefined || byte2 === undefined) {
      return false;
    }

    return byte1 === 0xff && (byte2 & 0xe0) === 0xe0;
  }

  private static parseFrameHeader(header: number): ParsedFrameHeader | null {
    const versionBits = (header >> 19) & 0x3;
    const layerBits = (header >> 17) & 0x3;
    const bitrateIndex = (header >> 12) & 0xf;
    const sampleRateIndex = (header >> 10) & 0x3;
    const padding = ((header >> 9) & 0x1) as 0 | 1;

    const version = this.decodeVersion(versionBits);
    const layer = this.decodeLayer(layerBits);

    if (!version || !layer) {
      return null;
    }

    if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      return null;
    }

    const bitrate = this.BITRATE_INDEX[version][layer][bitrateIndex];
    const sampleRate = this.SAMPLE_RATE_INDEX[version][sampleRateIndex];

    if (!bitrate || !sampleRate) {
      return null;
    }

    const samplesPerFrame = this.getSamplesPerFrame(version, layer);

    return {
      version,
      layer,
      bitrate,
      sampleRate,
      padding,
      samplesPerFrame
    };
  }

  private static decodeVersion(bits: number): 1 | 2 | 25 | null {
    switch (bits) {
      case 0b11:
        return 1;
      case 0b10:
        return 2;
      case 0b00:
        return 25;
      default:
        return null;
    }
  }

  private static decodeLayer(bits: number): 1 | 2 | 3 | null {
    switch (bits) {
      case 0b11:
        return 1;
      case 0b10:
        return 2;
      case 0b01:
        return 3;
      default:
        return null;
    }
  }

  private static getSamplesPerFrame(version: 1 | 2 | 25, layer: 1 | 2 | 3): number {
    if (layer === 1) {
      return 384;
    }

    if (layer === 2) {
      return 1152;
    }

    return version === 1 ? 1152 : 576;
  }
}
