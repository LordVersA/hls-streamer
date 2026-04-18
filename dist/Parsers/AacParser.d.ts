import { IMediaParser, MediaFileInfo, MediaFormat } from './IMediaParser';
export declare class AacParser implements IMediaParser {
    private static readonly SAMPLE_RATES;
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
    private analyzeAdts;
    private analyzeM4a;
    private parseAdtsHeader;
    private parseBoxes;
    private findBoxInData;
}
//# sourceMappingURL=AacParser.d.ts.map