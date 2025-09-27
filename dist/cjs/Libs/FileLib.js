"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileLib = void 0;
const mp3_duration_1 = __importDefault(require("mp3-duration"));
class FileLib {
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
            (0, mp3_duration_1.default)(mp3Buffer, (err, duration) => {
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
exports.FileLib = FileLib;
//# sourceMappingURL=FileLib.js.map