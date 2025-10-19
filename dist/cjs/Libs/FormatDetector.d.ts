import { AudioFormat } from '../Parsers/IAudioParser';
export declare class FormatDetector {
    static detectFormat(buffer: Buffer): AudioFormat | null;
    static detectFormatFromExtension(filePath: string): AudioFormat | null;
    static getSupportedExtensions(): string[];
    static isSupportedExtension(filePath: string): boolean;
}
//# sourceMappingURL=FormatDetector.d.ts.map