import mp3Duration from "mp3-duration";
export class FileLib {
    static getFileSizeInBytes(buffer) {
        if (Buffer.isBuffer(buffer)) {
            return buffer.length;
        }
        else {
            throw new Error("Input is not a buffer");
        }
    }
    static getMP3DurationFromBuffer(mp3Buffer) {
        return new Promise((resolve, reject) => {
            mp3Duration(mp3Buffer, (err, duration) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(duration);
                }
            });
        });
    }
}
//# sourceMappingURL=FileLib.js.map