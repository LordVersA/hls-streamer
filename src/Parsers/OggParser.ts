import { IAudioParser, AudioFileInfo, AudioFrameInfo, AudioFormat } from './IAudioParser';

/**
 * OGG Vorbis format parser
 * Parses OGG container and Vorbis audio codec
 */
export class OggParser implements IAudioParser {
  private static readonly OGG_SIGNATURE = 'OggS';

  getFormat(): AudioFormat {
    return 'ogg';
  }

  canParse(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer.toString('ascii', 0, 4) === OggParser.OGG_SIGNATURE;
  }

  analyze(buffer: Buffer, opts: { fileSize?: number } = {}): AudioFileInfo {
    const warnings: string[] = [];
    const size = opts.fileSize ?? buffer.length;

    if (!this.canParse(buffer)) {
      return {
        format: 'ogg',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['Not a valid OGG file']
      };
    }

    const pages: Array<{
      offset: number;
      headerSize: number;
      bodySize: number;
      granulePosition: bigint;
      serialNumber: number;
      pageSequence: number;
      isFirstPage: boolean;
      isContinued: boolean;
    }> = [];

    let offset = 0;
    let vorbisInfo: {
      channels: number;
      sampleRate: number;
      bitrateNominal: number;
    } | null = null;

    // Parse OGG pages
    while (offset + 27 <= buffer.length) {
      if (buffer.toString('ascii', offset, offset + 4) !== OggParser.OGG_SIGNATURE) {
        offset++;
        continue;
      }

      const version = buffer[offset + 4];
      const headerType = buffer[offset + 5];
      const granulePosition = buffer.readBigUInt64LE(offset + 6);
      const serialNumber = buffer.readUInt32LE(offset + 14);
      const pageSequence = buffer.readUInt32LE(offset + 18);
      const checksum = buffer.readUInt32LE(offset + 22);
      const numSegments = buffer[offset + 26];

      if (version !== 0) {
        warnings.push(`Unknown OGG version: ${version}`);
        offset++;
        continue;
      }

      if (offset + 27 + numSegments! > buffer.length) {
        warnings.push('Truncated page header');
        break;
      }

      // Read segment table
      const segmentTable = buffer.subarray(offset + 27, offset + 27 + numSegments!);
      const bodySize = segmentTable.reduce((sum, len) => sum + len, 0);

      const headerSize = 27 + numSegments!;
      const isFirstPage = (headerType! & 0x02) !== 0;
      const isContinued = (headerType! & 0x01) !== 0;

      pages.push({
        offset,
        headerSize,
        bodySize,
        granulePosition,
        serialNumber: serialNumber!,
        pageSequence: pageSequence!,
        isFirstPage,
        isContinued
      });

      // Try to parse Vorbis identification header from first page
      if (isFirstPage && !vorbisInfo && offset + headerSize + 30 <= buffer.length) {
        const packetData = buffer.subarray(offset + headerSize, offset + headerSize + bodySize);
        vorbisInfo = this.parseVorbisIdHeader(packetData);
      }

      offset += headerSize + bodySize;
    }

    if (pages.length === 0) {
      return {
        format: 'ogg',
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['No valid OGG pages found']
      };
    }

    // Calculate duration from granule position of last page
    const lastPage = pages[pages.length - 1];
    const totalSamples = lastPage ? Number(lastPage.granulePosition) : 0;
    const sampleRate = vorbisInfo?.sampleRate || 48000; // Default fallback
    const duration = totalSamples > 0 && sampleRate > 0 ? totalSamples / sampleRate : 0;

    // Calculate audio data size
    const audioDataSize = pages.reduce((sum, page) => sum + page.bodySize, 0);
    const averageBitrate = duration > 0
      ? (audioDataSize * 8) / duration / 1000
      : vorbisInfo?.bitrateNominal ? vorbisInfo.bitrateNominal / 1000 : undefined;

    // Create frames from OGG pages
    const frames: AudioFrameInfo[] = [];
    let previousGranule = 0n;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]!;
      const currentGranule = Number(page.granulePosition);

      // Calculate samples in this page
      const samplesInPage = currentGranule - Number(previousGranule);
      const pageDuration = samplesInPage > 0 && sampleRate > 0
        ? samplesInPage / sampleRate
        : 0;

      frames.push({
        index: i,
        offset: page.offset + page.headerSize,
        length: page.bodySize,
        duration: pageDuration,
        samples: Math.max(0, samplesInPage),
        sampleRate,
        bitrate: Math.round(averageBitrate || 0)
      });

      if (page.granulePosition !== -1n) {
        previousGranule = page.granulePosition;
      }
    }

    const metadata: AudioFileInfo = {
      format: 'ogg',
      size,
      duration,
      audioDataSize,
      frames
    };

    if (vorbisInfo) {
      metadata.sampleRate = vorbisInfo.sampleRate;
      metadata.channels = vorbisInfo.channels;

      if (averageBitrate !== undefined) {
        metadata.averageBitrate = averageBitrate;
      }

      metadata.metadata = {
        bitrateNominal: vorbisInfo.bitrateNominal,
        totalPages: pages.length
      };
    }

    if (warnings.length > 0) {
      metadata.warnings = warnings;
    }

    return metadata;
  }

  private parseVorbisIdHeader(packet: Buffer): {
    channels: number;
    sampleRate: number;
    bitrateNominal: number;
  } | null {
    if (packet.length < 30) {
      return null;
    }

    // Check for Vorbis identification header
    const packetType = packet[0];
    const vorbisSignature = packet.toString('ascii', 1, 7);

    if (packetType !== 1 || vorbisSignature !== 'vorbis') {
      return null;
    }

    const version = packet.readUInt32LE(7);
    if (version !== 0) {
      return null; // Only support Vorbis version 0
    }

    const channels = packet[11];
    const sampleRate = packet.readUInt32LE(12);
    const bitrateMaximum = packet.readUInt32LE(16);
    const bitrateNominal = packet.readUInt32LE(20);
    const bitrateMinimum = packet.readUInt32LE(24);

    return {
      channels: channels!,
      sampleRate: sampleRate!,
      bitrateNominal: bitrateNominal! || bitrateMaximum! || 128000 // Use nominal, or max, or default
    };
  }
}
