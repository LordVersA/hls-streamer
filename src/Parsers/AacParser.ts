import { IAudioParser, AudioFileInfo, AudioFrameInfo, AudioFormat } from './IAudioParser';

/**
 * AAC/M4A format parser
 * Supports both raw ADTS AAC and M4A container (MP4 with AAC audio)
 */
export class AacParser implements IAudioParser {
  private static readonly SAMPLE_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050,
    16000, 12000, 11025, 8000, 7350, 0, 0, 0
  ];

  getFormat(): AudioFormat {
    // Determine if ADTS or M4A
    return 'aac'; // Default to aac, will be overridden for m4a
  }

  canParse(buffer: Buffer): boolean {
    if (buffer.length < 4) {
      return false;
    }

    // Check for M4A (ftyp box)
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      return true;
    }

    // Check for ADTS AAC
    if (buffer[0] === 0xff && (buffer[1]! & 0xf6) === 0xf0) {
      return true;
    }

    return false;
  }

  analyze(buffer: Buffer, opts: { fileSize?: number } = {}): AudioFileInfo {
    const size = opts.fileSize ?? buffer.length;

    // Check if M4A or raw ADTS
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      return this.analyzeM4a(buffer, size);
    } else {
      return this.analyzeAdts(buffer, size);
    }
  }

  private analyzeAdts(buffer: Buffer, size: number): AudioFileInfo {
    const warnings: string[] = [];
    const frames: AudioFrameInfo[] = [];

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

    const metadata: AudioFileInfo = {
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

  private analyzeM4a(buffer: Buffer, size: number): AudioFileInfo {
    const warnings: string[] = [];

    // Parse MP4 boxes to find moov and mdat
    const boxes = this.parseBoxes(buffer);

    let duration = 0;
    let sampleRate: number | undefined;
    let channels: number | undefined;
    let bitrate: number | undefined;
    let audioDataSize = 0;

    // Find mdat box for audio data size
    const mdatBox = boxes.find(b => b.type === 'mdat');
    if (mdatBox) {
      audioDataSize = mdatBox.size - 8; // Subtract header
    }

    // Find moov box for metadata
    const moovBox = boxes.find(b => b.type === 'moov');
    if (moovBox && moovBox.offset + 8 <= buffer.length) {
      const moovData = buffer.subarray(moovBox.offset + 8, Math.min(buffer.length, moovBox.offset + moovBox.size));
      const mvhdBox = this.findBoxInData(moovData, 'mvhd');

      if (mvhdBox && mvhdBox.offset + 20 <= moovData.length) {
        const version = moovData[mvhdBox.offset];
        const offset = version === 1 ? mvhdBox.offset + 20 : mvhdBox.offset + 12;

        if (offset + 8 <= moovData.length) {
          const timescale = moovData.readUInt32BE(offset);
          const durationUnits = version === 1
            ? Number(moovData.readBigUInt64BE(offset + 4))
            : moovData.readUInt32BE(offset + 4);

          duration = timescale > 0 ? durationUnits / timescale : 0;
        }
      }

      // Try to find audio sample rate from mp4a box
      const mp4aBox = this.findBoxInData(moovData, 'mp4a');
      if (mp4aBox && mp4aBox.offset + 28 <= moovData.length) {
        channels = moovData.readUInt16BE(mp4aBox.offset + 16);
        sampleRate = moovData.readUInt32BE(mp4aBox.offset + 24) >> 16;
      }
    }

    const averageBitrate = duration > 0 ? (audioDataSize * 8) / duration / 1000 : undefined;

    // For M4A, create synthetic frames based on typical AAC frame duration
    const frames: AudioFrameInfo[] = [];
    if (duration > 0 && sampleRate) {
      const samplesPerFrame = 1024;
      const frameDuration = samplesPerFrame / sampleRate;
      const totalFrames = Math.ceil(duration / frameDuration);
      const avgFrameSize = audioDataSize / totalFrames;

      const mdatStart = mdatBox ? mdatBox.offset + 8 : 0;

      for (let i = 0; i < totalFrames; i++) {
        frames.push({
          index: i,
          offset: mdatStart + Math.floor(i * avgFrameSize),
          length: Math.floor(avgFrameSize),
          duration: frameDuration,
          samples: samplesPerFrame,
          sampleRate,
          bitrate: Math.round(averageBitrate || 0)
        });
      }
    }

    const metadata: AudioFileInfo = {
      format: 'm4a',
      size,
      duration,
      audioDataSize,
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

    metadata.metadata = {
      container: 'mp4',
      codec: 'aac'
    };

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

  private parseBoxes(buffer: Buffer): Array<{ type: string; size: number; offset: number }> {
    const boxes: Array<{ type: string; size: number; offset: number }> = [];
    let offset = 0;

    while (offset + 8 <= buffer.length) {
      let size = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);

      if (size === 1 && offset + 16 <= buffer.length) {
        // Extended size
        size = Number(buffer.readBigUInt64BE(offset + 8));
      } else if (size === 0) {
        // Box extends to end of file
        size = buffer.length - offset;
      }

      boxes.push({ type, size, offset });

      if (size < 8 || offset + size > buffer.length) {
        break;
      }

      offset += size;
    }

    return boxes;
  }

  private findBoxInData(data: Buffer, boxType: string): { offset: number; size: number } | null {
    let offset = 0;

    while (offset + 8 <= data.length) {
      let size = data.readUInt32BE(offset);
      const type = data.toString('ascii', offset + 4, offset + 8);

      if (size === 1 && offset + 16 <= data.length) {
        size = Number(data.readBigUInt64BE(offset + 8));
      }

      if (type === boxType) {
        return { offset: offset + 8, size };
      }

      if (size < 8 || offset + size > data.length) {
        break;
      }

      offset += size;
    }

    return null;
  }
}
