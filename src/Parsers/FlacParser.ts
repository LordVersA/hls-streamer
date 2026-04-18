import { IMediaParser, MediaFileInfo, MediaFrameInfo, MediaFormat } from './IMediaParser';

/**
 * FLAC (Free Lossless Audio Codec) format parser
 */
export class FlacParser implements IMediaParser {
  private static readonly FLAC_SIGNATURE = 'fLaC';

  getFormat(): MediaFormat {
    return 'flac';
  }

  canParse(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer.toString('ascii', 0, 4) === FlacParser.FLAC_SIGNATURE;
  }

  analyze(buffer: Buffer, opts: { fileSize?: number } = {}): MediaFileInfo {
    const warnings: string[] = [];
    const size = opts.fileSize ?? buffer.length;

    if (!this.canParse(buffer)) {
      return {
        format: 'flac',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['Not a valid FLAC file']
      };
    }

    // Parse FLAC metadata blocks
    let offset = 4; // Skip 'fLaC' signature
    let streamInfo: {
      minBlockSize: number;
      maxBlockSize: number;
      minFrameSize: number;
      maxFrameSize: number;
      sampleRate: number;
      channels: number;
      bitsPerSample: number;
      totalSamples: bigint;
    } | null = null;

    let audioDataOffset = -1;

    // Parse metadata blocks
    while (offset + 4 <= buffer.length) {
      const blockHeader = buffer[offset];
      if (blockHeader === undefined) break;

      const isLast = (blockHeader & 0x80) !== 0;
      const blockType = blockHeader & 0x7f;
      const blockLength = (buffer[offset + 1]! << 16) | (buffer[offset + 2]! << 8) | buffer[offset + 3]!;

      offset += 4;

      if (blockType === 0) {
        // STREAMINFO block (required, must be first)
        if (blockLength < 34) {
          warnings.push('Invalid STREAMINFO block size');
          break;
        }

        streamInfo = this.parseStreamInfo(buffer, offset);
      }

      offset += blockLength;

      if (isLast) {
        audioDataOffset = offset;
        break;
      }
    }

    if (!streamInfo) {
      return {
        format: 'flac',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['Missing STREAMINFO block']
      };
    }

    // Calculate duration
    const duration = streamInfo.sampleRate > 0
      ? Number(streamInfo.totalSamples) / streamInfo.sampleRate
      : 0;

    const audioDataSize = audioDataOffset > 0 ? size - audioDataOffset : 0;
    const averageBitrate = duration > 0 ? (audioDataSize * 8) / duration / 1000 : undefined;

    // Parse FLAC frames for accurate segmentation
    const frames: MediaFrameInfo[] = [];

    if (audioDataOffset > 0 && audioDataOffset < buffer.length) {
      let frameOffset = audioDataOffset;
      let frameIndex = 0;
      const maxFrames = 10000; // Safety limit

      while (frameOffset + 4 <= buffer.length && frameIndex < maxFrames) {
        const frameHeader = this.findNextFrameSync(buffer, frameOffset);

        if (frameHeader === -1) {
          break; // No more frames found
        }

        frameOffset = frameHeader;
        const frameInfo = this.parseFrameHeader(buffer, frameOffset, streamInfo);

        if (!frameInfo) {
          frameOffset++;
          continue;
        }

        // Estimate frame size (FLAC frames are variable size)
        const estimatedFrameSize = streamInfo.maxFrameSize > 0
          ? streamInfo.maxFrameSize
          : Math.ceil((streamInfo.maxBlockSize * streamInfo.bitsPerSample * streamInfo.channels) / 8) + 16;

        const frameDuration = frameInfo.blockSize / streamInfo.sampleRate;

        frames.push({
          index: frameIndex,
          offset: frameOffset,
          length: estimatedFrameSize,
          duration: frameDuration,
          samples: frameInfo.blockSize,
          sampleRate: streamInfo.sampleRate,
          bitrate: Math.round(averageBitrate || 0)
        });

        frameIndex++;
        frameOffset += estimatedFrameSize;
      }
    }

    // If frame parsing failed or wasn't possible, create synthetic frames
    if (frames.length === 0 && duration > 0) {
      warnings.push('Could not parse FLAC frames, using estimated segmentation');
      const framesPerSecond = streamInfo.sampleRate / streamInfo.maxBlockSize;
      const totalFrames = Math.ceil(duration * framesPerSecond);
      const avgFrameSize = audioDataSize / totalFrames;

      let frameOffset = audioDataOffset;
      for (let i = 0; i < totalFrames; i++) {
        const frameDuration = streamInfo.maxBlockSize / streamInfo.sampleRate;
        frames.push({
          index: i,
          offset: frameOffset,
          length: Math.floor(avgFrameSize),
          duration: frameDuration,
          samples: streamInfo.maxBlockSize,
          sampleRate: streamInfo.sampleRate,
          bitrate: Math.round(averageBitrate || 0)
        });
        frameOffset += avgFrameSize;
      }
    }

    const metadata: MediaFileInfo = {
      format: 'flac',
      size,
      duration,
      audioDataSize,
      sampleRate: streamInfo.sampleRate,
      channels: streamInfo.channels,
      bitDepth: streamInfo.bitsPerSample,
      frames
    };

    if (averageBitrate !== undefined) {
      metadata.averageBitrate = averageBitrate;
    }

    if (warnings.length > 0) {
      metadata.warnings = warnings;
    }

    metadata.metadata = {
      minBlockSize: streamInfo.minBlockSize,
      maxBlockSize: streamInfo.maxBlockSize,
      minFrameSize: streamInfo.minFrameSize,
      maxFrameSize: streamInfo.maxFrameSize,
      totalSamples: streamInfo.totalSamples.toString()
    };

    return metadata;
  }

  private parseStreamInfo(buffer: Buffer, offset: number) {
    const minBlockSize = buffer.readUInt16BE(offset);
    const maxBlockSize = buffer.readUInt16BE(offset + 2);
    const minFrameSize = (buffer[offset + 4]! << 16) | (buffer[offset + 5]! << 8) | buffer[offset + 6]!;
    const maxFrameSize = (buffer[offset + 7]! << 16) | (buffer[offset + 8]! << 8) | buffer[offset + 9]!;

    // Sample rate (20 bits), channels (3 bits), bits per sample (5 bits)
    const word1 = buffer.readUInt32BE(offset + 10);
    const word2 = buffer.readUInt32BE(offset + 14);

    const sampleRate = (word1 >> 12) & 0xfffff; // Top 20 bits
    const channels = ((word1 >> 9) & 0x7) + 1; // Next 3 bits, +1 for actual count
    const bitsPerSample = ((word1 >> 4) & 0x1f) + 1; // Next 5 bits, +1 for actual value

    // Total samples (36 bits)
    const totalSamplesHigh = BigInt(word1 & 0xf); // Bottom 4 bits of word1
    const totalSamplesLow = BigInt(word2);
    const totalSamples = (totalSamplesHigh << 32n) | totalSamplesLow;

    return {
      minBlockSize,
      maxBlockSize,
      minFrameSize,
      maxFrameSize,
      sampleRate,
      channels,
      bitsPerSample,
      totalSamples
    };
  }

  private findNextFrameSync(buffer: Buffer, startOffset: number): number {
    // FLAC frame sync: 0b11111111111110
    for (let i = startOffset; i < buffer.length - 1; i++) {
      if (buffer[i] === 0xff && (buffer[i + 1]! & 0xfc) === 0xf8) {
        return i;
      }
    }
    return -1;
  }

  private parseFrameHeader(buffer: Buffer, offset: number, streamInfo: any): { blockSize: number } | null {
    if (offset + 4 > buffer.length) {
      return null;
    }

    // Verify sync code
    if (buffer[offset] !== 0xff || (buffer[offset + 1]! & 0xfc) !== 0xf8) {
      return null;
    }

    const byte2 = buffer[offset + 2];
    if (byte2 === undefined) return null;

    // Block size strategy (4 bits)
    const blockSizeCode = (byte2 >> 4) & 0x0f;

    // Simple block size decoding (simplified version)
    let blockSize = streamInfo.maxBlockSize;

    if (blockSizeCode >= 1 && blockSizeCode <= 5) {
      blockSize = 192 * (1 << (blockSizeCode - 1));
    } else if (blockSizeCode === 6 || blockSizeCode === 7) {
      blockSize = streamInfo.maxBlockSize; // Would need to read more bytes
    } else if (blockSizeCode >= 8 && blockSizeCode <= 15) {
      blockSize = 256 * (1 << (blockSizeCode - 8));
    }

    return { blockSize };
  }
}
