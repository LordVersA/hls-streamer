import { IAudioParser, AudioFileInfo, AudioFormat } from './IAudioParser';
export declare class Mp3Parser implements IAudioParser {
    private static readonly BITRATE_INDEX;
    private static readonly SAMPLE_RATE_INDEX;
    getFormat(): AudioFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): AudioFileInfo;
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