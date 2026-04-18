import { IMediaParser, MediaFormat } from './IMediaParser';
export declare class ParserFactory {
    private static parsers;
    static getParser(format: MediaFormat): IMediaParser | null;
    static detectParser(buffer: Buffer): IMediaParser | null;
    static getParserByExtension(filePath: string): IMediaParser | null;
    static getSupportedFormats(): MediaFormat[];
    static isFormatSupported(format: string): boolean;
}
//# sourceMappingURL=ParserFactory.d.ts.map