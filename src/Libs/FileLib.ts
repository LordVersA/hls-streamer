// @ts-ignore
import mp3Duration from "mp3-duration";

export class FileLib {
  static getFileSizeInBytes(buffer: Buffer) {
    if (Buffer.isBuffer(buffer)) {
      return buffer.length;
    } else {
      throw new Error("Input is not a buffer");
    }
  }

  static getMP3DurationFromBuffer(mp3Buffer: Buffer) {
    return new Promise((resolve, reject) => {
      mp3Duration(mp3Buffer, (err: any, duration: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(duration);
        }
      });
    });
  }
}
