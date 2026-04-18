import { MediaFormat } from '../Parsers/IMediaParser';
export declare class FormatDetector {
    static detectFormat(buffer: Buffer): MediaFormat | null;
    static detectFormatFromExtension(filePath: string): MediaFormat | null;
    static getSupportedExtensions(): string[];
    static isSupportedExtension(filePath: string): boolean;
}
//# sourceMappingURL=FormatDetector.d.ts.map