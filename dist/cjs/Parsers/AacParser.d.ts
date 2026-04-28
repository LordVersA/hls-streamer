import { IMediaParser, MediaFileInfo, MediaFormat } from './IMediaParser';
export declare class AacParser implements IMediaParser {
    private static readonly SAMPLE_RATES;
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
    private analyzeAdts;
    private parseAdtsHeader;
}
//# sourceMappingURL=AacParser.d.ts.map