import { IMediaParser, MediaFileInfo, MediaFormat } from './IMediaParser';
export declare class WavParser implements IMediaParser {
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
}
//# sourceMappingURL=WavParser.d.ts.map