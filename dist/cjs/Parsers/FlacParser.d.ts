import { IMediaParser, MediaFileInfo, MediaFormat } from './IMediaParser';
export declare class FlacParser implements IMediaParser {
    private static readonly FLAC_SIGNATURE;
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
    private parseStreamInfo;
    private findNextFrameSync;
    private parseFrameHeader;
}
//# sourceMappingURL=FlacParser.d.ts.map