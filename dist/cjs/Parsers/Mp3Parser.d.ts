import { IMediaParser, MediaFileInfo, MediaFormat } from './IMediaParser';
export declare class Mp3Parser implements IMediaParser {
    private static readonly BITRATE_INDEX;
    private static readonly SAMPLE_RATE_INDEX;
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
    private calculateFrameLength;
    private getId3Offsets;
    private syncSafeInteger;
    private isFrameSync;
    private parseFrameHeader;
    private decodeVersion;
    private decodeLayer;
    private getSamplesPerFrame;
}
//# sourceMappingURL=Mp3Parser.d.ts.map