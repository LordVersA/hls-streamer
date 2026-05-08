import fs from 'fs';
import path from 'path';

export class MockMP3 {
  private static readonly FRAME_HEADER = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
  private static readonly FRAME_LENGTH = 417; // Layer III, MPEG1, 128kbps @ 44.1kHz

  static createMockMP3Buffer(sizeInBytes: number = 1024): Buffer {
    if (sizeInBytes <= 0) {
      return Buffer.alloc(0);
    }

    const buffer = Buffer.alloc(sizeInBytes);
    let offset = 0;

    while (offset + this.FRAME_LENGTH <= sizeInBytes) {
      this.FRAME_HEADER.copy(buffer, offset);
      for (let i = 4; i < this.FRAME_LENGTH; i++) {
        buffer[offset + i] = (i - 4) & 0xFF;
      }
      offset += this.FRAME_LENGTH;
    }

    const remaining = sizeInBytes - offset;
    if (remaining > 0) {
      this.FRAME_HEADER.copy(buffer, offset, 0, Math.min(4, remaining));
      for (let i = 4; i < remaining; i++) {
        buffer[offset + i] = i & 0xFF;
      }
    }

    return buffer;
  }

  static createMockMP3WithOverstatedId3Buffer(): { buffer: Buffer; audioOffset: number } {
    const actualId3PayloadSize = 100;
    const declaredId3PayloadSize = 1000;
    const audioOffset = 10 + actualId3PayloadSize;
    const frameCount = 6;
    const buffer = Buffer.alloc(audioOffset + frameCount * this.FRAME_LENGTH);

    buffer.write('ID3', 0);
    buffer[3] = 0x03;
    buffer[4] = 0x00;
    buffer[5] = 0x00;
    this.writeSyncSafeInteger(buffer, 6, declaredId3PayloadSize);

    // Looks like an MPEG header inside metadata, but it is not followed by real frames.
    this.FRAME_HEADER.copy(buffer, 40);

    let offset = audioOffset;
    for (let i = 0; i < frameCount; i++) {
      this.writeFrame(buffer, offset);
      offset += this.FRAME_LENGTH;
    }

    return { buffer, audioOffset };
  }

  static async createMockMP3File(filePath: string, sizeInBytes: number = 1024): Promise<void> {
    const buffer = this.createMockMP3Buffer(sizeInBytes);
    await fs.promises.writeFile(filePath, new Uint8Array(buffer));
  }

  static getTestMP3Path(filename: string = 'test.mp3'): string {
    return path.join(__dirname, filename);
  }

  static async cleanup(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  private static writeFrame(buffer: Buffer, offset: number): void {
    this.FRAME_HEADER.copy(buffer, offset);
    for (let i = 4; i < this.FRAME_LENGTH; i++) {
      buffer[offset + i] = (i - 4) & 0xFF;
    }
  }

  private static writeSyncSafeInteger(buffer: Buffer, offset: number, value: number): void {
    buffer[offset] = (value >> 21) & 0x7F;
    buffer[offset + 1] = (value >> 14) & 0x7F;
    buffer[offset + 2] = (value >> 7) & 0x7F;
    buffer[offset + 3] = value & 0x7F;
  }
}
