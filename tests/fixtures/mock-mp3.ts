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
}
