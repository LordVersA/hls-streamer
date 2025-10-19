"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserFactory = void 0;
const Mp3Parser_1 = require("./Mp3Parser");
const AacParser_1 = require("./AacParser");
const OggParser_1 = require("./OggParser");
const FlacParser_1 = require("./FlacParser");
const WavParser_1 = require("./WavParser");
const FormatDetector_1 = require("../Libs/FormatDetector");
class ParserFactory {
    static getParser(format) {
        const searchFormat = format === 'm4a' ? 'aac' : format;
        return this.parsers.find(parser => parser.getFormat() === searchFormat) || null;
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
        const format = FormatDetector_1.FormatDetector.detectFormatFromExtension(filePath);
        return format ? this.getParser(format) : null;
    }
    static getSupportedFormats() {
        return ['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav'];
    }
    static isFormatSupported(format) {
        return this.getSupportedFormats().includes(format);
    }
}
exports.ParserFactory = ParserFactory;
Object.defineProperty(ParserFactory, "parsers", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: [
        new Mp3Parser_1.Mp3Parser(),
        new AacParser_1.AacParser(),
        new OggParser_1.OggParser(),
        new FlacParser_1.FlacParser(),
        new WavParser_1.WavParser()
    ]
});
//# sourceMappingURL=ParserFactory.js.map