import { Mp3FileInfo } from '../Interfaces/HlsStreamer';
export declare class FileLib {
    private static readonly BITRATE_INDEX;
    private static readonly SAMPLE_RATE_INDEX;
    static getFileSizeInBytes(buffer: Buffer): number;
    static getMP3DurationFromBuffer(mp3Buffer: Buffer): Promise<number>;
    static analyzeMP3Buffer(buffer: Buffer, opts?: {
        fileSize?: number;
    }): Mp3FileInfo;
    static analyzeMP3File(filePath: string): Promise<Mp3FileInfo>;
    private static calculateFrameLength;
    private static getId3Offsets;
    private static syncSafeInteger;
    private static isFrameSync;
    private static parseFrameHeader;
    private static decodeVersion;
    private static decodeLayer;
    private static getSamplesPerFrame;
}
//# sourceMappingURL=FileLib.d.ts.map