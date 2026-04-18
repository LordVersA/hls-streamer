import { Mp3FileInfo, MediaFileInfo } from '../Interfaces/HlsStreamer';
import { MediaFormat } from '../Parsers/IMediaParser';
export declare class FileLib {
    private static readonly BITRATE_INDEX;
    private static readonly SAMPLE_RATE_INDEX;
    static getFileSizeInBytes(buffer: Buffer): number;
    static getMP3DurationFromBuffer(mp3Buffer: Buffer): Promise<number>;
    static analyzeMP3Buffer(buffer: Buffer, opts?: {
        fileSize?: number;
    }): Mp3FileInfo;
    static analyzeMP3File(filePath: string): Promise<Mp3FileInfo>;
    static analyzeMediaFile(filePath: string, format?: MediaFormat): Promise<MediaFileInfo>;
    static analyzeAudioFile(filePath: string, format?: MediaFormat): Promise<MediaFileInfo>;
    static analyzeMediaBuffer(buffer: Buffer, opts?: {
        fileSize?: number;
        filePath?: string;
        format?: MediaFormat;
    }): MediaFileInfo;
    static analyzeAudioBuffer(buffer: Buffer, opts?: {
        fileSize?: number;
        filePath?: string;
        format?: MediaFormat;
    }): MediaFileInfo;
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