import { IAudioParser, AudioFileInfo, AudioFormat } from './IAudioParser';
export declare class AacParser implements IAudioParser {
    private static readonly SAMPLE_RATES;
    getFormat(): AudioFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): AudioFileInfo;
    private analyzeAdts;
    private analyzeM4a;
    private parseAdtsHeader;
    private parseBoxes;
    private findBoxInData;
}
//# sourceMappingURL=AacParser.d.ts.map