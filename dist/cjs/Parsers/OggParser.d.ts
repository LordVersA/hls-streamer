import { IAudioParser, AudioFileInfo, AudioFormat } from './IAudioParser';
export declare class OggParser implements IAudioParser {
    private static readonly OGG_SIGNATURE;
    getFormat(): AudioFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): AudioFileInfo;
    private parseVorbisIdHeader;
}
//# sourceMappingURL=OggParser.d.ts.map