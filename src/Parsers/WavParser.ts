import { IAudioParser, AudioFileInfo, AudioFrameInfo, AudioFormat } from './IAudioParser';

/**
 * WAV (RIFF/WAVE) format parser
 * Supports uncompressed PCM audio
 */
export class WavParser implements IAudioParser {
  getFormat(): AudioFormat {
    return 'wav';
  }

  canParse(buffer: Buffer): boolean {
    return buffer.length >= 12 &&
           buffer.toString('ascii', 0, 4) === 'RIFF' &&
           buffer.toString('ascii', 8, 12) === 'WAVE';
  }

  analyze(buffer: Buffer, opts: { fileSize?: number } = {}): AudioFileInfo {
    const warnings: string[] = [];
    const size = opts.fileSize ?? buffer.length;

    if (buffer.length < 44) {
      return {
        format: 'wav',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['File too small to be valid WAV']
      };
    }

    if (!this.canParse(buffer)) {
      return {
        format: 'wav',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['Not a valid WAV file']
      };
    }

    // Parse RIFF chunk
    const riffSize = buffer.readUInt32LE(4);

    // Find fmt chunk
    let offset = 12;
    let fmtData: {
      audioFormat: number;
      channels: number;
      sampleRate: number;
      byteRate: number;
      blockAlign: number;
      bitsPerSample: number;
    } | null = null;

    let dataOffset = -1;
    let dataSize = 0;

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);

      if (chunkId === 'fmt ') {
        if (chunkSize < 16) {
          warnings.push('Invalid fmt chunk size');
          break;
        }

        fmtData = {
          audioFormat: buffer.readUInt16LE(offset + 8),
          channels: buffer.readUInt16LE(offset + 10),
          sampleRate: buffer.readUInt32LE(offset + 12),
          byteRate: buffer.readUInt32LE(offset + 16),
          blockAlign: buffer.readUInt16LE(offset + 20),
          bitsPerSample: buffer.readUInt16LE(offset + 22)
        };
      } else if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataSize = chunkSize;
      }

      offset += 8 + chunkSize;

      // Handle odd-sized chunks (RIFF chunks are word-aligned)
      if (chunkSize % 2 !== 0) {
        offset++;
      }
    }

    if (!fmtData) {
      return {
        format: 'wav',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['Missing fmt chunk']
      };
    }

    if (dataOffset === -1) {
      return {
        format: 'wav',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['Missing data chunk']
      };
    }

    // Only support PCM (format 1)
    if (fmtData.audioFormat !== 1) {
      warnings.push(`Unsupported audio format: ${fmtData.audioFormat} (only PCM supported)`);
    }

    // Calculate duration
    const bytesPerSample = fmtData.bitsPerSample / 8;
    const totalSamples = dataSize / (bytesPerSample * fmtData.channels);
    const duration = fmtData.sampleRate > 0 ? totalSamples / fmtData.sampleRate : 0;

    // For WAV, create virtual "frames" representing reasonable chunks
    // We'll use 1-second frames for segmentation purposes
    const frames: AudioFrameInfo[] = [];
    const samplesPerFrame = fmtData.sampleRate; // 1 second worth
    const bytesPerFrame = samplesPerFrame * bytesPerSample * fmtData.channels;

    let frameOffset = dataOffset;
    let frameIndex = 0;
    let remainingBytes = dataSize;

    while (remainingBytes > 0) {
      const frameBytes = Math.min(bytesPerFrame, remainingBytes);
      const frameSamples = frameBytes / (bytesPerSample * fmtData.channels);
      const frameDuration = frameSamples / fmtData.sampleRate;

      frames.push({
        index: frameIndex,
        offset: frameOffset,
        length: frameBytes,
        duration: frameDuration,
        samples: Math.floor(frameSamples),
        sampleRate: fmtData.sampleRate,
        bitrate: Math.round((fmtData.byteRate * 8) / 1000) // Convert bytes/sec to kbps
      });

      frameOffset += frameBytes;
      remainingBytes -= frameBytes;
      frameIndex++;
    }

    const metadata: AudioFileInfo = {
      format: 'wav',
      size,
      duration,
      audioDataSize: dataSize,
      sampleRate: fmtData.sampleRate,
      channels: fmtData.channels,
      bitDepth: fmtData.bitsPerSample,
      averageBitrate: Math.round((fmtData.byteRate * 8) / 1000),
      frames
    };

    if (warnings.length > 0) {
      metadata.warnings = warnings;
    }

    metadata.metadata = {
      audioFormat: fmtData.audioFormat,
      blockAlign: fmtData.blockAlign,
      riffSize
    };

    return metadata;
  }
}
