import { IAudioParser, AudioFileInfo, AudioFormat } from './IAudioParser';
export declare class FlacParser implements IAudioParser {
    private static readonly FLAC_SIGNATURE;
    getFormat(): AudioFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): AudioFileInfo;
    private parseStreamInfo;
    private findNextFrameSync;
    private parseFrameHeader;
}
//# sourceMappingURL=FlacParser.d.ts.map