import fs from 'fs';
import path from 'path';

export class MockMP3 {
  static createMockMP3Buffer(sizeInBytes: number = 1024): Buffer {
    // Create a buffer that looks like a basic MP3 file
    const buffer = Buffer.alloc(sizeInBytes);

    // Add MP3 header (frame sync bits)
    buffer[0] = 0xFF; // Frame sync (11111111)
    buffer[1] = 0xFB; // Frame sync (111) + Version (01) + Layer (01) + Protection (1)
    buffer[2] = 0x90; // Bitrate (1001) + Sample rate (00) + Padding (0) + Private (0)
    buffer[3] = 0x00; // Channel mode (00) + Mode extension (00) + Copyright (0) + Original (0) + Emphasis (00)

    // Fill the rest with some pattern to simulate audio data
    for (let i = 4; i < sizeInBytes; i++) {
      buffer[i] = (i % 256);
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