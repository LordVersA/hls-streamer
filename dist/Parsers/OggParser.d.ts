import { IMediaParser, MediaFileInfo, MediaFormat } from './IMediaParser';
export declare class OggParser implements IMediaParser {
    private static readonly OGG_SIGNATURE;
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
    private parseVorbisIdHeader;
}
//# sourceMappingURL=OggParser.d.ts.map