import fs from 'node:fs';
import { ParserFactory } from '../Parsers/ParserFactory';
import { Mp3Parser } from '../Parsers/Mp3Parser';
export class FileLib {
    static getFileSizeInBytes(buffer) {
        if (Buffer.isBuffer(buffer)) {
            return buffer.length;
        }
        else {
            throw new Error("Input is not a buffer");
        }
    }
    static async getMP3DurationFromBuffer(mp3Buffer) {
        const { duration } = this.analyzeMP3Buffer(mp3Buffer);
        return duration;
    }
    static analyzeMP3Buffer(buffer, opts = {}) {
        const parsed = new Mp3Parser().analyze(buffer, opts);
        const frames = parsed.frames.map((frame) => ({
            index: frame.index,
            offset: frame.offset,
            length: frame.length,
            duration: frame.duration,
            samples: frame.samples,
            sampleRate: frame.sampleRate,
            bitrate: frame.bitrate,
            padding: (((buffer[frame.offset + 2] ?? 0) >> 1) & 0x1)
        }));
        const metadata = {
            size: parsed.size,
            duration: parsed.duration,
            audioDataSize: parsed.audioDataSize,
            frames
        };
        if (parsed.sampleRate !== undefined) {
            metadata.sampleRate = parsed.sampleRate;
        }
        if (parsed.averageBitrate !== undefined) {
            metadata.averageBitrate = parsed.averageBitrate;
        }
        const id3v2Size = parsed.metadata?.['id3v2Size'];
        if (typeof id3v2Size === 'number' && id3v2Size > 0) {
            metadata.id3v2Size = id3v2Size;
        }
        const id3v1Size = parsed.metadata?.['id3v1Size'];
        if (typeof id3v1Size === 'number' && id3v1Size > 0) {
            metadata.id3v1Size = id3v1Size;
        }
        if (parsed.warnings?.length) {
            metadata.warnings = parsed.warnings;
        }
        return metadata;
    }
    static async analyzeMP3File(filePath) {
        const [buffer, stat] = await Promise.all([
            fs.promises.readFile(filePath),
            fs.promises.stat(filePath)
        ]);
        return this.analyzeMP3Buffer(buffer, { fileSize: stat.size });
    }
    static async analyzeMediaFile(filePath, format) {
        const [buffer, stat] = await Promise.all([
            fs.promises.readFile(filePath),
            fs.promises.stat(filePath)
        ]);
        const opts = {
            fileSize: stat.size,
            filePath
        };
        if (format !== undefined) {
            opts.format = format;
        }
        return this.analyzeMediaBuffer(buffer, opts);
    }
    static async analyzeAudioFile(filePath, format) {
        return this.analyzeMediaFile(filePath, format);
    }
    static analyzeMediaBuffer(buffer, opts = {}) {
        let parser;
        if (opts.format) {
            parser = ParserFactory.getParser(opts.format);
            if (!parser) {
                throw new Error(`Unsupported format: ${opts.format}`);
            }
        }
        if (!parser && opts.filePath) {
            parser = ParserFactory.getParserByExtension(opts.filePath);
        }
        if (!parser) {
            parser = ParserFactory.detectParser(buffer);
        }
        if (!parser) {
            throw new Error('Could not detect audio format');
        }
        const analyzeOpts = opts.fileSize !== undefined ? { fileSize: opts.fileSize } : {};
        return parser.analyze(buffer, analyzeOpts);
    }
    static analyzeAudioBuffer(buffer, opts = {}) {
        return this.analyzeMediaBuffer(buffer, opts);
    }
}
//# sourceMappingURL=FileLib.js.map