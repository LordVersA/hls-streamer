import { Mp3Parser } from './Mp3Parser';
import { AacParser } from './AacParser';
import { OggParser } from './OggParser';
import { FlacParser } from './FlacParser';
import { WavParser } from './WavParser';
import { Mp4Parser } from './Mp4Parser';
import { FormatDetector } from '../Libs/FormatDetector';
export class ParserFactory {
    static getParser(format) {
        const searchFormat = format === 'm4a' ? 'aac' : format;
        const resolvedFormat = (searchFormat === 'mov' || searchFormat === 'm4v') ? 'mp4' : searchFormat;
        return this.parsers.find(parser => parser.getFormat() === resolvedFormat) || null;
    }
    static detectParser(buffer) {
        for (const parser of this.parsers) {
            if (parser.canParse(buffer)) {
                return parser;
            }
        }
        return null;
    }
    static getParserByExtension(filePath) {
        const format = FormatDetector.detectFormatFromExtension(filePath);
        return format ? this.getParser(format) : null;
    }
    static getSupportedFormats() {
        return ['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav', 'mp4', 'mov', 'm4v'];
    }
    static isFormatSupported(format) {
        return this.getSupportedFormats().includes(format);
    }
}
Object.defineProperty(ParserFactory, "parsers", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: [
        new Mp3Parser(),
        new AacParser(),
        new OggParser(),
        new FlacParser(),
        new WavParser(),
        new Mp4Parser(),
    ]
});
//# sourceMappingURL=ParserFactory.js.map