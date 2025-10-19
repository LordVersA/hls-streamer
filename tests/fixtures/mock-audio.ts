import fs from 'fs';
import path from 'path';

/**
 * Mock audio file generators for testing different formats
 */
export class MockAudio {
  /**
   * Create a minimal valid WAV file
   */
  static createWav(outputPath: string, durationSeconds: number = 1): void {
    const sampleRate = 44100;
    const numChannels = 2;
    const bitsPerSample = 16;
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Chunk size
    buffer.writeUInt16LE(1, 20); // Audio format (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // Byte rate
    buffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // Block align
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Fill with sine wave data
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.floor(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 32767);
      const offset = 44 + i * numChannels * (bitsPerSample / 8);
      buffer.writeInt16LE(sample, offset); // Left channel
      buffer.writeInt16LE(sample, offset + 2); // Right channel
    }

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
  }

  /**
   * Create a minimal valid FLAC file
   */
  static createFlac(outputPath: string): void {
    const buffer = Buffer.alloc(512);
    let offset = 0;

    // fLaC signature
    buffer.write('fLaC', offset);
    offset += 4;

    // STREAMINFO block (last metadata block)
    buffer[offset] = 0x80; // Last block flag + block type 0 (STREAMINFO)
    offset++;

    // Block length (34 bytes)
    buffer.writeUIntBE(34, offset, 3);
    offset += 3;

    // Min block size (4096)
    buffer.writeUInt16BE(4096, offset);
    offset += 2;

    // Max block size (4096)
    buffer.writeUInt16BE(4096, offset);
    offset += 2;

    // Min frame size (0 = unknown)
    buffer.writeUIntBE(0, offset, 3);
    offset += 3;

    // Max frame size (0 = unknown)
    buffer.writeUIntBE(0, offset, 3);
    offset += 3;

    // Sample rate (44100 Hz), channels (2), bits per sample (16), total samples
    // This is a complex 70-bit field
    const sampleRate = 44100;
    const channels = 1; // stored as channels-1
    const bitsPerSample = 15; // stored as bits-1
    const totalSamples = 44100; // 1 second

    const word1 = (sampleRate << 12) | (channels << 9) | (bitsPerSample << 4) | ((totalSamples >> 32) & 0xF);
    const word2 = totalSamples & 0xFFFFFFFF;

    buffer.writeUInt32BE(word1, offset);
    offset += 4;
    buffer.writeUInt32BE(word2, offset);
    offset += 4;

    // MD5 signature (16 bytes of zeros)
    buffer.fill(0, offset, offset + 16);
    offset += 16;

    // Add a minimal frame header (frame sync)
    buffer[offset] = 0xFF;
    buffer[offset + 1] = 0xF8;

    // Ensure directory exists
    const dir1 = path.dirname(outputPath);
    if (!fs.existsSync(dir1)) {
      fs.mkdirSync(dir1, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer.subarray(0, offset + 2));
  }

  /**
   * Create a minimal valid OGG Vorbis file
   */
  static createOgg(outputPath: string): void {
    const buffer = Buffer.alloc(512);
    let offset = 0;

    // First OGG page - Vorbis identification header
    offset += this.writeOggPage(buffer, offset, {
      version: 0,
      headerType: 0x02, // Beginning of stream
      granulePosition: 0n,
      serialNumber: 12345,
      pageSequence: 0,
      segments: [30] // One segment of 30 bytes
    });

    // Vorbis identification header
    buffer[offset] = 0x01; // Packet type
    offset++;
    buffer.write('vorbis', offset);
    offset += 6;
    buffer.writeUInt32LE(0, offset); // Vorbis version
    offset += 4;
    buffer[offset] = 2; // Channels
    offset++;
    buffer.writeUInt32LE(44100, offset); // Sample rate
    offset += 4;
    buffer.writeUInt32LE(128000, offset); // Bitrate maximum
    offset += 4;
    buffer.writeUInt32LE(128000, offset); // Bitrate nominal
    offset += 4;
    buffer.writeUInt32LE(128000, offset); // Bitrate minimum
    offset += 4;
    buffer[offset] = 0xB8; // Block sizes
    offset++;
    buffer[offset] = 0x01; // Framing flag
    offset++;

    // Ensure directory exists
    const dir2 = path.dirname(outputPath);
    if (!fs.existsSync(dir2)) {
      fs.mkdirSync(dir2, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer.subarray(0, offset));
  }

  private static writeOggPage(buffer: Buffer, offset: number, opts: {
    version: number;
    headerType: number;
    granulePosition: bigint;
    serialNumber: number;
    pageSequence: number;
    segments: number[];
  }): number {
    const start = offset;

    // Capture pattern
    buffer.write('OggS', offset);
    offset += 4;

    // Version
    buffer[offset] = opts.version;
    offset++;

    // Header type
    buffer[offset] = opts.headerType;
    offset++;

    // Granule position
    buffer.writeBigUInt64LE(opts.granulePosition, offset);
    offset += 8;

    // Serial number
    buffer.writeUInt32LE(opts.serialNumber, offset);
    offset += 4;

    // Page sequence
    buffer.writeUInt32LE(opts.pageSequence, offset);
    offset += 4;

    // Checksum (placeholder, should calculate CRC)
    buffer.writeUInt32LE(0, offset);
    offset += 4;

    // Number of segments
    buffer[offset] = opts.segments.length;
    offset++;

    // Segment table
    for (const seg of opts.segments) {
      buffer[offset] = seg;
      offset++;
    }

    return offset - start;
  }

  /**
   * Create a minimal valid AAC ADTS file
   */
  static createAac(outputPath: string): void {
    const buffer = Buffer.alloc(512); // Increased buffer size
    let offset = 0;

    // Create 3 ADTS frames
    for (let i = 0; i < 3; i++) {
      offset += this.writeAdtsFrame(buffer, offset, {
        sampleRateIndex: 4, // 44100 Hz
        channelConfig: 2,
        frameLength: 100
      });
    }

    // Ensure directory exists
    const dir3 = path.dirname(outputPath);
    if (!fs.existsSync(dir3)) {
      fs.mkdirSync(dir3, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer.subarray(0, offset));
  }

  private static writeAdtsFrame(buffer: Buffer, offset: number, opts: {
    sampleRateIndex: number;
    channelConfig: number;
    frameLength: number;
  }): number {
    // Sync word (12 bits)
    buffer[offset] = 0xFF;
    buffer[offset + 1] = 0xF0;

    // MPEG version, layer, protection absent
    buffer[offset + 1] |= 0x01; // Protection absent

    // Profile, sample rate index, channel config
    buffer[offset + 2] = (1 << 6) | (opts.sampleRateIndex << 2) | (opts.channelConfig >> 2);
    buffer[offset + 3] = ((opts.channelConfig & 0x3) << 6);

    // Frame length
    buffer[offset + 3] |= (opts.frameLength >> 11) & 0x3;
    buffer[offset + 4] = (opts.frameLength >> 3) & 0xFF;
    buffer[offset + 5] = ((opts.frameLength & 0x7) << 5) | 0x1F;

    // ADTS buffer fullness
    buffer[offset + 6] = 0xFC;

    // Fill rest with dummy data
    buffer.fill(0, offset + 7, offset + opts.frameLength);

    return opts.frameLength;
  }

  /**
   * Create a minimal valid M4A file
   */
  static createM4a(outputPath: string): void {
    const buffer = Buffer.alloc(512);
    let offset = 0;

    // ftyp box
    offset += this.writeMp4Box(buffer, offset, 'ftyp', (buf, off) => {
      buf.write('M4A ', off); // Major brand
      buf.writeUInt32BE(0, off + 4); // Minor version
      buf.write('M4A mp42isom', off + 8); // Compatible brands
      return 20;
    });

    // mdat box (minimal)
    offset += this.writeMp4Box(buffer, offset, 'mdat', (buf, off) => {
      buf.fill(0, off, off + 100); // Dummy audio data
      return 100;
    });

    // moov box
    offset += this.writeMp4Box(buffer, offset, 'moov', (buf, off) => {
      let moovOff = off;

      // mvhd box
      moovOff += this.writeMp4Box(buf, moovOff, 'mvhd', (b, o) => {
        b[o] = 0; // Version
        b.writeUIntBE(0, o + 1, 3); // Flags
        b.writeUInt32BE(0, o + 4); // Creation time
        b.writeUInt32BE(0, o + 8); // Modification time
        b.writeUInt32BE(44100, o + 12); // Timescale
        b.writeUInt32BE(44100, o + 16); // Duration (1 second)
        return 20;
      });

      return moovOff - off;
    });

    // Ensure directory exists
    const dir4 = path.dirname(outputPath);
    if (!fs.existsSync(dir4)) {
      fs.mkdirSync(dir4, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer.subarray(0, offset));
  }

  private static writeMp4Box(buffer: Buffer, offset: number, type: string, writeContent: (buf: Buffer, off: number) => number): number {
    const sizeOffset = offset;
    offset += 4; // Reserve space for size
    buffer.write(type, offset);
    offset += 4;

    const contentSize = writeContent(buffer, offset);
    offset += contentSize;

    const totalSize = 8 + contentSize;
    buffer.writeUInt32BE(totalSize, sizeOffset);

    return totalSize;
  }

  /**
   * Clean up test files
   */
  static async cleanup(...paths: string[]): Promise<void> {
    for (const p of paths) {
      try {
        await fs.promises.unlink(p);
      } catch (e) {
        // Ignore errors
      }
    }
  }
}
