import { IMediaParser, MediaFileInfo, MediaFrameInfo, MediaFormat } from './IMediaParser';

interface Box {
  offset: number;
  size: number;
  type: string;
  dataOffset: number;
}

interface TrackInfo {
  timescale: number;
  duration: number;
  width: number;
  height: number;
  isVideo: boolean;
  sttsEntries: Array<{ count: number; delta: number }>;
  stszSizes: number[];
  stszDefaultSize: number;
  stszSampleCount: number;
  stcoOffsets: number[];
  stssKeyframes: Set<number>;
  stscEntries: Array<{ firstChunk: number; samplesPerChunk: number; descIndex: number }>;
  frameRate: number;
}

/**
 * MP4/MOV/M4V parser — pure-JS, zero dependencies.
 * Produces an fMP4-compatible frame table for HLS byte-range streaming.
 */
export class Mp4Parser implements IMediaParser {
  getFormat(): MediaFormat {
    return 'mp4';
  }

  canParse(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    const boxType = buffer.toString('ascii', 4, 8);
    if (boxType !== 'ftyp') return false;
    const brand = buffer.toString('ascii', 8, 12);
    const videoBrands = ['isom', 'mp41', 'mp42', 'M4V ', 'M4A ', 'avc1', 'iso2', 'iso5', 'iso6'];
    return videoBrands.includes(brand) || boxType === 'ftyp';
  }

  analyze(buffer: Buffer, opts: { fileSize?: number } = {}): MediaFileInfo {
    const size = opts.fileSize ?? buffer.length;
    const warnings: string[] = [];

    const format = this.detectFormat(buffer);

    // Locate moov box
    const moovBox = this.findTopLevelBox(buffer, 'moov');
    if (!moovBox) {
      return {
        format,
        size,
        duration: 0,
        audioDataSize: 0,
        frames: [],
        warnings: ['Could not find moov box']
      };
    }

    const initSegment = { offset: moovBox.offset, length: moovBox.size };
    const moovData = buffer.subarray(moovBox.dataOffset, moovBox.offset + moovBox.size);

    // Parse mvhd for movie-level timescale and duration
    const mvhd = this.findBox(moovData, 'mvhd');
    let movieTimescale = 1000;
    let movieDuration = 0;
    if (mvhd) {
      const d = moovData;
      const o = mvhd.dataOffset;
      const version = d[o];
      if (version === 1) {
        movieTimescale = d.readUInt32BE(o + 16);
        movieDuration = Number(d.readBigUInt64BE(o + 20));
      } else {
        movieTimescale = d.readUInt32BE(o + 8);
        movieDuration = d.readUInt32BE(o + 12);
      }
    }
    const totalDurationSeconds = movieTimescale > 0 ? movieDuration / movieTimescale : 0;

    // Parse all trak boxes
    const tracks = this.parseTracks(moovData, warnings);

    // Pick the best video track (prefer video, then first audio)
    const videoTrack = tracks.find(t => t.isVideo) ?? tracks[0];

    if (!videoTrack) {
      return {
        format,
        size,
        duration: totalDurationSeconds,
        audioDataSize: 0,
        frames: [],
        initSegment,
        warnings: ['No tracks found']
      };
    }

    // Build frame table from sample table
    const frames = this.buildFrameTable(videoTrack, warnings);

    const audioDataSize = frames.reduce((acc, f) => acc + f.length, 0);
    const averageBitrate = totalDurationSeconds > 0
      ? (audioDataSize * 8) / totalDurationSeconds / 1000
      : undefined;

    const result: MediaFileInfo = {
      format,
      size,
      duration: totalDurationSeconds,
      audioDataSize,
      frames,
      initSegment,
    };

    if (videoTrack.isVideo) {
      result.width = videoTrack.width;
      result.height = videoTrack.height;
      if (videoTrack.frameRate > 0) {
        result.frameRate = videoTrack.frameRate;
      }
    }

    if (averageBitrate !== undefined) {
      result.averageBitrate = averageBitrate;
    }

    result.metadata = { container: format === 'mov' ? 'mov' : 'mp4' };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  private detectFormat(buffer: Buffer): MediaFormat {
    if (buffer.length < 12) return 'mp4';
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'qt  ') return 'mov';
    if (brand.startsWith('M4V')) return 'm4v';
    return 'mp4';
  }

  private findTopLevelBox(buffer: Buffer, type: string): Box | null {
    let offset = 0;
    while (offset + 8 <= buffer.length) {
      let size = buffer.readUInt32BE(offset);
      const boxType = buffer.toString('ascii', offset + 4, offset + 8);
      let dataOffset = offset + 8;

      if (size === 1) {
        if (offset + 16 > buffer.length) break;
        size = Number(buffer.readBigUInt64BE(offset + 8));
        dataOffset = offset + 16;
      } else if (size === 0) {
        size = buffer.length - offset;
      }

      if (size < 8) break;

      if (boxType === type) {
        return { offset, size, type: boxType, dataOffset };
      }

      offset += size;
    }
    return null;
  }

  private findBox(data: Buffer, type: string): Box | null {
    let offset = 0;
    while (offset + 8 <= data.length) {
      let size = data.readUInt32BE(offset);
      const boxType = data.toString('ascii', offset + 4, offset + 8);
      let dataOffset = offset + 8;

      if (size === 1) {
        if (offset + 16 > data.length) break;
        size = Number(data.readBigUInt64BE(offset + 8));
        dataOffset = offset + 16;
      } else if (size === 0) {
        size = data.length - offset;
      }

      if (size < 8) break;

      if (boxType === type) {
        return { offset, size, type: boxType, dataOffset };
      }

      offset += size;
    }
    return null;
  }

  private findAllBoxes(data: Buffer, type: string): Box[] {
    const results: Box[] = [];
    let offset = 0;
    while (offset + 8 <= data.length) {
      let size = data.readUInt32BE(offset);
      const boxType = data.toString('ascii', offset + 4, offset + 8);
      let dataOffset = offset + 8;

      if (size === 1) {
        if (offset + 16 > data.length) break;
        size = Number(data.readBigUInt64BE(offset + 8));
        dataOffset = offset + 16;
      } else if (size === 0) {
        size = data.length - offset;
      }

      if (size < 8) break;

      if (boxType === type) {
        results.push({ offset, size, type: boxType, dataOffset });
      }

      offset += size;
    }
    return results;
  }

  private parseTracks(moovData: Buffer, warnings: string[]): TrackInfo[] {
    const trakBoxes = this.findAllBoxes(moovData, 'trak');
    const tracks: TrackInfo[] = [];

    for (const trak of trakBoxes) {
      const trakData = moovData.subarray(trak.dataOffset, trak.offset + trak.size);
      const track = this.parseTrack(trakData, warnings);
      if (track) tracks.push(track);
    }

    return tracks;
  }

  private parseTrack(trakData: Buffer, warnings: string[]): TrackInfo | null {
    const tkhd = this.findBox(trakData, 'tkhd');
    let width = 0;
    let height = 0;

    if (tkhd) {
      const o = tkhd.dataOffset;
      const version = trakData[o];
      // width and height are 16.16 fixed-point at the end of tkhd
      const tkhdSize = tkhd.size;
      if (version === 1 && tkhdSize >= 96) {
        width = trakData.readUInt32BE(o + 76) >> 16;
        height = trakData.readUInt32BE(o + 80) >> 16;
      } else if (tkhdSize >= 84) {
        width = trakData.readUInt32BE(o + 52) >> 16;
        height = trakData.readUInt32BE(o + 56) >> 16;
      }
    }

    const mdia = this.findBox(trakData, 'mdia');
    if (!mdia) return null;

    const mdiaData = trakData.subarray(mdia.dataOffset, mdia.offset + mdia.size);

    const mdhd = this.findBox(mdiaData, 'mdhd');
    let timescale = 1000;
    let trackDuration = 0;
    if (mdhd) {
      const o = mdhd.dataOffset;
      const version = mdiaData[o];
      if (version === 1) {
        timescale = mdiaData.readUInt32BE(o + 16);
        trackDuration = Number(mdiaData.readBigUInt64BE(o + 20));
      } else {
        timescale = mdiaData.readUInt32BE(o + 8);
        trackDuration = mdiaData.readUInt32BE(o + 12);
      }
    }

    // Detect media type from hdlr
    const hdlr = this.findBox(mdiaData, 'hdlr');
    let isVideo = false;
    if (hdlr) {
      const handlerType = mdiaData.toString('ascii', hdlr.dataOffset + 4, hdlr.dataOffset + 8);
      isVideo = handlerType === 'vide';
    }

    const minf = this.findBox(mdiaData, 'minf');
    if (!minf) return null;

    const minfData = mdiaData.subarray(minf.dataOffset, minf.offset + minf.size);

    const stbl = this.findBox(minfData, 'stbl');
    if (!stbl) return null;

    const stblData = minfData.subarray(stbl.dataOffset, stbl.offset + stbl.size);

    // stts — time-to-sample
    const sttsEntries = this.parseStts(stblData);

    // stsz — sample sizes
    const { defaultSize, sampleCount, sizes } = this.parseStsz(stblData);

    // stco/co64 — chunk offsets
    const chunkOffsets = this.parseStco(stblData);

    // stss — sync sample table (keyframes)
    const keyframeSet = this.parseStss(stblData);

    // stsc — sample-to-chunk
    const stscEntries = this.parseStsc(stblData);

    // Estimate frame rate from stts
    let frameRate = 0;
    if (sttsEntries.length > 0 && timescale > 0) {
      const firstEntry = sttsEntries[0]!;
      if (firstEntry.delta > 0) {
        frameRate = timescale / firstEntry.delta;
      }
    }

    return {
      timescale,
      duration: trackDuration,
      width,
      height,
      isVideo,
      sttsEntries,
      stszSizes: sizes,
      stszDefaultSize: defaultSize,
      stszSampleCount: sampleCount,
      stcoOffsets: chunkOffsets,
      stssKeyframes: keyframeSet,
      stscEntries,
      frameRate,
    };
  }

  private parseStts(stblData: Buffer): Array<{ count: number; delta: number }> {
    const stts = this.findBox(stblData, 'stts');
    if (!stts) return [];

    const o = stts.dataOffset;
    // skip version+flags (4 bytes)
    const entryCount = stblData.readUInt32BE(o + 4);
    const entries: Array<{ count: number; delta: number }> = [];

    for (let i = 0; i < entryCount; i++) {
      const base = o + 8 + i * 8;
      if (base + 8 > stblData.length) break;
      entries.push({
        count: stblData.readUInt32BE(base),
        delta: stblData.readUInt32BE(base + 4),
      });
    }

    return entries;
  }

  private parseStsz(stblData: Buffer): { defaultSize: number; sampleCount: number; sizes: number[] } {
    const stsz = this.findBox(stblData, 'stsz');
    if (!stsz) return { defaultSize: 0, sampleCount: 0, sizes: [] };

    const o = stsz.dataOffset;
    const defaultSize = stblData.readUInt32BE(o + 4);
    const sampleCount = stblData.readUInt32BE(o + 8);
    const sizes: number[] = [];

    if (defaultSize === 0) {
      for (let i = 0; i < sampleCount; i++) {
        const base = o + 12 + i * 4;
        if (base + 4 > stblData.length) break;
        sizes.push(stblData.readUInt32BE(base));
      }
    }

    return { defaultSize, sampleCount, sizes };
  }

  private parseStco(stblData: Buffer): number[] {
    // Try co64 first (64-bit offsets)
    const co64 = this.findBox(stblData, 'co64');
    if (co64) {
      const o = co64.dataOffset;
      const entryCount = stblData.readUInt32BE(o + 4);
      const offsets: number[] = [];
      for (let i = 0; i < entryCount; i++) {
        const base = o + 8 + i * 8;
        if (base + 8 > stblData.length) break;
        offsets.push(Number(stblData.readBigUInt64BE(base)));
      }
      return offsets;
    }

    const stco = this.findBox(stblData, 'stco');
    if (!stco) return [];

    const o = stco.dataOffset;
    const entryCount = stblData.readUInt32BE(o + 4);
    const offsets: number[] = [];
    for (let i = 0; i < entryCount; i++) {
      const base = o + 8 + i * 4;
      if (base + 4 > stblData.length) break;
      offsets.push(stblData.readUInt32BE(base));
    }
    return offsets;
  }

  private parseStss(stblData: Buffer): Set<number> {
    const stss = this.findBox(stblData, 'stss');
    const keyframes = new Set<number>();
    if (!stss) return keyframes;

    const o = stss.dataOffset;
    const entryCount = stblData.readUInt32BE(o + 4);
    for (let i = 0; i < entryCount; i++) {
      const base = o + 8 + i * 4;
      if (base + 4 > stblData.length) break;
      keyframes.add(stblData.readUInt32BE(base));
    }
    return keyframes;
  }

  private parseStsc(stblData: Buffer): Array<{ firstChunk: number; samplesPerChunk: number; descIndex: number }> {
    const stsc = this.findBox(stblData, 'stsc');
    if (!stsc) return [];

    const o = stsc.dataOffset;
    const entryCount = stblData.readUInt32BE(o + 4);
    const entries: Array<{ firstChunk: number; samplesPerChunk: number; descIndex: number }> = [];

    for (let i = 0; i < entryCount; i++) {
      const base = o + 8 + i * 12;
      if (base + 12 > stblData.length) break;
      entries.push({
        firstChunk: stblData.readUInt32BE(base),
        samplesPerChunk: stblData.readUInt32BE(base + 4),
        descIndex: stblData.readUInt32BE(base + 8),
      });
    }

    return entries;
  }

  private buildFrameTable(track: TrackInfo, warnings: string[]): MediaFrameInfo[] {
    const frames: MediaFrameInfo[] = [];
    const { sttsEntries, stszSizes, stszDefaultSize, stszSampleCount, stcoOffsets, stscEntries, stssKeyframes, timescale } = track;

    if (stcoOffsets.length === 0 || stszSampleCount === 0) {
      warnings.push('Missing chunk offset or sample size table');
      return frames;
    }

    // Build per-sample durations from stts
    const sampleDurations: number[] = [];
    for (const entry of sttsEntries) {
      for (let i = 0; i < entry.count; i++) {
        sampleDurations.push(entry.delta);
      }
    }

    // Build per-sample sizes
    const getSampleSize = (i: number): number => {
      if (stszDefaultSize > 0) return stszDefaultSize;
      return stszSizes[i] ?? 0;
    };

    // Map samples to chunks using stsc
    // stsc: each entry tells us "from firstChunk onwards, each chunk has N samples"
    const getSamplesPerChunk = (chunkIndex1based: number): number => {
      let result = 1;
      for (const entry of stscEntries) {
        if (chunkIndex1based >= entry.firstChunk) {
          result = entry.samplesPerChunk;
        } else {
          break;
        }
      }
      return result;
    };

    let sampleIndex = 0;
    for (let chunkIdx = 0; chunkIdx < stcoOffsets.length && sampleIndex < stszSampleCount; chunkIdx++) {
      const chunkOffset = stcoOffsets[chunkIdx]!;
      const samplesInChunk = getSamplesPerChunk(chunkIdx + 1);
      let offsetInChunk = 0;

      for (let s = 0; s < samplesInChunk && sampleIndex < stszSampleCount; s++) {
        const sampleSize = getSampleSize(sampleIndex);
        const sampleDelta = sampleDurations[sampleIndex] ?? (sampleDurations[sampleDurations.length - 1] ?? 1);
        const duration = timescale > 0 ? sampleDelta / timescale : 0;
        const sampleNumber1based = sampleIndex + 1;

        frames.push({
          index: sampleIndex,
          offset: chunkOffset + offsetInChunk,
          length: sampleSize,
          duration,
          samples: sampleDelta,
          sampleRate: timescale,
          bitrate: duration > 0 ? Math.round((sampleSize * 8) / duration / 1000) : 0,
          keyFrame: stssKeyframes.size === 0 ? true : stssKeyframes.has(sampleNumber1based),
        });

        offsetInChunk += sampleSize;
        sampleIndex++;
      }
    }

    return frames;
  }
}
