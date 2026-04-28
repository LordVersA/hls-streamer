"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AacParser = void 0;
const Mp4Parser_1 = require("./Mp4Parser");
class AacParser {
    getFormat() {
        return 'aac';
    }
    canParse(buffer) {
        if (buffer.length < 4) {
            return false;
        }
        if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
            const brand = buffer.toString('ascii', 8, 12);
            if (brand === 'M4A ' || brand === 'M4B ') {
                return true;
            }
            return false;
        }
        if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) {
            return true;
        }
        return false;
    }
    analyze(buffer, opts = {}) {
        const size = opts.fileSize ?? buffer.length;
        if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
            const result = new Mp4Parser_1.Mp4Parser().analyze(buffer, opts);
            return { ...result, format: 'm4a' };
        }
        return this.analyzeAdts(buffer, size);
    }
    analyzeAdts(buffer, size) {
        const warnings = [];
        const frames = [];
        let offset = 0;
        let frameIndex = 0;
        let sampleRate;
        let channels;
        let totalDuration = 0;
        let totalBytes = 0;
        while (offset + 7 <= buffer.length) {
            if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xf6) !== 0xf0) {
                offset++;
                continue;
            }
            const header = this.parseAdtsHeader(buffer, offset);
            if (!header) {
                offset++;
                continue;
            }
            if (offset + header.frameLength > buffer.length) {
                warnings.push(`Truncated ADTS frame at offset ${offset}`);
                break;
            }
            sampleRate = sampleRate ?? header.sampleRate;
            channels = channels ?? header.channels;
            const samplesPerFrame = 1024;
            const frameDuration = samplesPerFrame / header.sampleRate;
            frames.push({
                index: frameIndex,
                offset,
                length: header.frameLength,
                duration: frameDuration,
                samples: samplesPerFrame,
                sampleRate: header.sampleRate,
                bitrate: Math.round((header.frameLength * 8 * header.sampleRate) / samplesPerFrame / 1000)
            });
            totalDuration += frameDuration;
            totalBytes += header.frameLength;
            offset += header.frameLength;
            frameIndex++;
        }
        if (frames.length === 0) {
            return {
                format: 'aac',
                size,
                duration: 0,
                audioDataSize: 0,
                frames: [],
                warnings: ['No valid ADTS frames found']
            };
        }
        const averageBitrate = totalDuration > 0 ? (totalBytes * 8) / totalDuration / 1000 : undefined;
        const metadata = {
            format: 'aac',
            size,
            duration: totalDuration,
            audioDataSize: totalBytes,
            frames
        };
        if (sampleRate !== undefined) {
            metadata.sampleRate = sampleRate;
        }
        if (channels !== undefined) {
            metadata.channels = channels;
        }
        if (averageBitrate !== undefined) {
            metadata.averageBitrate = averageBitrate;
        }
        if (warnings.length > 0) {
            metadata.warnings = warnings;
        }
        return metadata;
    }
    parseAdtsHeader(buffer, offset) {
        if (offset + 7 > buffer.length) {
            return null;
        }
        const byte2 = buffer[offset + 2];
        const byte3 = buffer[offset + 3];
        const byte4 = buffer[offset + 4];
        const byte5 = buffer[offset + 5];
        const sampleRateIndex = (byte2 >> 2) & 0x0f;
        const channelConfig = ((byte2 & 0x01) << 2) | ((byte3 >> 6) & 0x03);
        const sampleRate = AacParser.SAMPLE_RATES[sampleRateIndex];
        if (!sampleRate || sampleRate === 0) {
            return null;
        }
        const frameLength = ((byte3 & 0x03) << 11) | (byte4 << 3) | ((byte5 >> 5) & 0x07);
        return {
            sampleRate,
            channels: channelConfig,
            frameLength
        };
    }
}
exports.AacParser = AacParser;
Object.defineProperty(AacParser, "SAMPLE_RATES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: [
        96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050,
        16000, 12000, 11025, 8000, 7350, 0, 0, 0
    ]
});
//# sourceMappingURL=AacParser.js.map