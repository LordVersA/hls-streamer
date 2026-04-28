import { IMediaParser, MediaFileInfo, MediaFrameInfo, MediaFormat } from './IMediaParser';
import { Mp4Parser } from './Mp4Parser';

/**
 * AAC/M4A format parser
 * Supports both raw ADTS AAC and M4A container (MP4 with AAC audio)
 */
export class AacParser implements IMediaParser {
  private static readonly SAMPLE_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050,
    16000, 12000, 11025, 8000, 7350, 0, 0, 0
  ];

  getFormat(): MediaFormat {
    // Determine if ADTS or M4A
    return 'aac'; // Default to aac, will be overridden for m4a
  }

  canParse(buffer: Buffer): boolean {
    if (buffer.length < 4) {
      return false;
    }

    // Check for M4A audio (ftyp box with audio-specific brands only)
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      const brand = buffer.toString('ascii', 8, 12);
      if (brand === 'M4A ' || brand === 'M4B ') {
        return true;
      }
      return false;
    }

    // Check for ADTS AAC
    if (buffer[0] === 0xff && (buffer[1]! & 0xf6) === 0xf0) {
      return true;
    }

    return false;
  }

  analyze(buffer: Buffer, opts: { fileSize?: number } = {}): MediaFileInfo {
    const size = opts.fileSize ?? buffer.length;

    // Delegate M4A to Mp4Parser which reads the real stsz sample table
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      const result = new Mp4Parser().analyze(buffer, opts);
      return { ...result, format: 'm4a' };
    }

    return this.analyzeAdts(buffer, size);
  }

  private analyzeAdts(buffer: Buffer, size: number): MediaFileInfo {
    const warnings: string[] = [];
    const frames: MediaFrameInfo[] = [];

    let offset = 0;
    let frameIndex = 0;
    let sampleRate: number | undefined;
    let channels: number | undefined;
    let totalDuration = 0;
    let totalBytes = 0;

    // Parse ADTS frames
    while (offset + 7 <= buffer.length) {
      // Look for ADTS sync word
      if (buffer[offset] !== 0xff || (buffer[offset + 1]! & 0xf6) !== 0xf0) {
        offset++;
        continue;
      }

      // Parse ADTS header
      const header = this.parseAdtsHeader(buffer, offset);
      if (!header) {
        offset++;
        continue;
      }

      if (offset + header.frameLength > buffer.length) {
        warnings.push(`Truncated ADTS frame at offset ${offset}`);
        break;
      }

      sampleRate = sampleRate ?? header.sampleRate;
      channels = channels ?? header.channels;

      // AAC frame typically contains 1024 samples
      const samplesPerFrame = 1024;
      const frameDuration = samplesPerFrame / header.sampleRate;

      frames.push({
        index: frameIndex,
        offset,
        length: header.frameLength,
        duration: frameDuration,
        samples: samplesPerFrame,
        sampleRate: header.sampleRate,
        bitrate: Math.round((header.frameLength * 8 * header.sampleRate) / samplesPerFrame / 1000)
      });

      totalDuration += frameDuration;
      totalBytes += header.frameLength;
      offset += header.frameLength;
      frameIndex++;
    }

    if (frames.length === 0) {
      return {
        format: 'aac',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['No valid ADTS frames found']
      };
    }

    const averageBitrate = totalDuration > 0 ? (totalBytes * 8) / totalDuration / 1000 : undefined;

    const metadata: MediaFileInfo = {
      format: 'aac',
      size,
      duration: totalDuration,
      audioDataSize: totalBytes,
      frames
    };

    if (sampleRate !== undefined) {
      metadata.sampleRate = sampleRate;
    }

    if (channels !== undefined) {
      metadata.channels = channels;
    }

    if (averageBitrate !== undefined) {
      metadata.averageBitrate = averageBitrate;
    }

    if (warnings.length > 0) {
      metadata.warnings = warnings;
    }

    return metadata;
  }

  private parseAdtsHeader(buffer: Buffer, offset: number): {
    sampleRate: number;
    channels: number;
    frameLength: number;
  } | null {
    if (offset + 7 > buffer.length) {
      return null;
    }

    const byte2 = buffer[offset + 2]!;
    const byte3 = buffer[offset + 3]!;
    const byte4 = buffer[offset + 4]!;
    const byte5 = buffer[offset + 5]!;

    const sampleRateIndex = (byte2 >> 2) & 0x0f;
    const channelConfig = ((byte2 & 0x01) << 2) | ((byte3 >> 6) & 0x03);

    const sampleRate = AacParser.SAMPLE_RATES[sampleRateIndex];
    if (!sampleRate || sampleRate === 0) {
      return null;
    }

    const frameLength = ((byte3 & 0x03) << 11) | (byte4 << 3) | ((byte5 >> 5) & 0x07);

    return {
      sampleRate,
      channels: channelConfig,
      frameLength
    };
  }

}
