import { IAudioParser, AudioFormat } from './IAudioParser';
export declare class ParserFactory {
    private static parsers;
    static getParser(format: AudioFormat): IAudioParser | null;
    static detectParser(buffer: Buffer): IAudioParser | null;
    static getParserByExtension(filePath: string): IAudioParser | null;
    static getSupportedFormats(): AudioFormat[];
    static isFormatSupported(format: string): boolean;
}
//# sourceMappingURL=ParserFactory.d.ts.map