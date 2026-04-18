import { IMediaParser, MediaFileInfo, MediaFormat } from './IMediaParser';
export declare class Mp4Parser implements IMediaParser {
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
    private detectFormat;
    private findTopLevelBox;
    private findBox;
    private findAllBoxes;
    private parseTracks;
    private parseTrack;
    private parseStts;
    private parseStsz;
    private parseStco;
    private parseStss;
    private parseStsc;
    private buildFrameTable;
}
//# sourceMappingURL=Mp4Parser.d.ts.map