import { IAudioParser, AudioFileInfo, AudioFormat } from './IAudioParser';
export declare class WavParser implements IAudioParser {
    getFormat(): AudioFormat;
    canParse(buffer: Buffer): boolean;
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): AudioFileInfo;
}
//# sourceMappingURL=WavParser.d.ts.map