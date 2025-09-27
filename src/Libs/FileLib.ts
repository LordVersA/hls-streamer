import mp3Duration from "mp3-duration";

/**
 * File utility functions
 */
export class FileLib {
  /**
   * Get buffer size in bytes
   */
  static getFileSizeInBytes(buffer: Buffer): number {
    if (Buffer.isBuffer(buffer)) {
      return buffer.length;
    } else {
      throw new Error("Input is not a buffer");
    }
  }

  /**
   * Extract MP3 duration from buffer data
   */
  static getMP3DurationFromBuffer(mp3Buffer: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      mp3Duration(mp3Buffer, (err: Error | null, duration: number) => {
        if (err) {
          reject(err);
        } else {
          resolve(duration);
        }
      });
    });
  }
}
