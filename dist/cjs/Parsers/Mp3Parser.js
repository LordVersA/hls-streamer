"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mp3Parser = void 0;
class Mp3Parser {
    getFormat() {
        return 'mp3';
    }
    canParse(buffer) {
        if (buffer.length < 2) {
            return false;
        }
        if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
            return true;
        }
        const byte1 = buffer[0];
        const byte2 = buffer[1];
        if (byte1 === 0xff && (byte2 & 0xe0) === 0xe0) {
            const versionBits = (byte2 >> 3) & 0x3;
            const layerBits = (byte2 >> 1) & 0x3;
            return versionBits !== 0x1 && layerBits !== 0x0;
        }
        return false;
    }
    analyze(buffer, opts = {}) {
        const warnings = [];
        const size = opts.fileSize ?? buffer.length;
        if (buffer.length === 0) {
            return {
                format: 'mp3',
                size,
                duration: 0,
                audioDataSize: 0,
                frames: []
            };
        }
        const offsets = this.getId3Offsets(buffer);
        const frames = [];
        const payloadSize = Math.max(0, offsets.audioEnd - offsets.startOffset);
        let offset = offsets.startOffset;
        let frameIndex = 0;
        let sampleRate;
        let channels;
        let totalDuration = 0;
        let totalAudioBytes = 0;
        while (offset + 4 <= offsets.audioEnd) {
            if (!this.isFrameSync(buffer, offset)) {
                offset++;
                continue;
            }
            const header = buffer.readUInt32BE(offset);
            const parsed = this.parseFrameHeader(header);
            if (!parsed) {
                offset++;
                continue;
            }
            const frameLength = this.calculateFrameLength(parsed);
            if (frameLength <= 0) {
                warnings.push(`Encountered zero-length frame at offset ${offset}`);
                offset++;
                continue;
            }
            if (offset + frameLength > buffer.length) {
                warnings.push(`Truncated frame at offset ${offset}`);
                break;
            }
            sampleRate = sampleRate ?? parsed.sampleRate;
            if (channels === undefined) {
                const channelMode = (header >> 6) & 0x3;
                channels = channelMode === 3 ? 1 : 2;
            }
            const frameDuration = parsed.samplesPerFrame / parsed.sampleRate;
            frames.push({
                index: frameIndex,
                offset,
                length: frameLength,
                duration: frameDuration,
                samples: parsed.samplesPerFrame,
                sampleRate: parsed.sampleRate,
                bitrate: parsed.bitrate
            });
            frameIndex++;
            totalDuration += frameDuration;
            totalAudioBytes += frameLength;
            offset += frameLength;
        }
        if (frames.length === 0) {
            const estimatedDuration = buffer.length / 16000;
            warnings.push('Falling back to heuristic duration due to missing MP3 frames');
            const metadata = {
                format: 'mp3',
                size,
                duration: Math.max(0.001, estimatedDuration),
                audioDataSize: payloadSize,
                frames: []
            };
            if (warnings.length) {
                metadata.warnings = warnings;
            }
            return metadata;
        }
        const duration = totalDuration;
        const averageBitrate = duration > 0 ? (totalAudioBytes * 8) / duration / 1000 : undefined;
        const metadata = {
            format: 'mp3',
            size,
            duration,
            audioDataSize: totalAudioBytes || payloadSize,
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
        if (offsets.id3v2Size > 0 || offsets.id3v1Size > 0) {
            metadata.metadata = {};
            if (offsets.id3v2Size > 0) {
                metadata.metadata['id3v2Size'] = offsets.id3v2Size;
            }
            if (offsets.id3v1Size > 0) {
                metadata.metadata['id3v1Size'] = offsets.id3v1Size;
            }
        }
        if (warnings.length) {
            metadata.warnings = warnings;
        }
        return metadata;
    }
    calculateFrameLength(frame) {
        if (frame.layer === 1) {
            return Math.floor(((12 * frame.bitrate * 1000) / frame.sampleRate + frame.padding) * 4);
        }
        const multiplier = frame.layer === 3 && frame.version !== 1 ? 72 : 144;
        return Math.floor((multiplier * frame.bitrate * 1000) / frame.sampleRate + frame.padding);
    }
    getId3Offsets(buffer) {
        let startOffset = 0;
        let id3v2Size = 0;
        if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
            const sizeBytes = buffer.subarray(6, 10);
            id3v2Size = this.syncSafeInteger(sizeBytes);
            startOffset = Math.min(buffer.length, 10 + id3v2Size);
        }
        let id3v1Size = 0;
        let audioEnd = buffer.length;
        if (buffer.length >= 128) {
            const tagOffset = buffer.length - 128;
            if (buffer.toString('ascii', tagOffset, tagOffset + 3) === 'TAG') {
                id3v1Size = 128;
                audioEnd = tagOffset;
            }
        }
        return {
            startOffset,
            id3v2Size,
            audioEnd,
            id3v1Size
        };
    }
    syncSafeInteger(bytes) {
        return ((bytes[0] & 0x7f) << 21) |
            ((bytes[1] & 0x7f) << 14) |
            ((bytes[2] & 0x7f) << 7) |
            (bytes[3] & 0x7f);
    }
    isFrameSync(buffer, offset) {
        const byte1 = buffer[offset];
        const byte2 = buffer[offset + 1];
        if (byte1 === undefined || byte2 === undefined) {
            return false;
        }
        return byte1 === 0xff && (byte2 & 0xe0) === 0xe0;
    }
    parseFrameHeader(header) {
        const versionBits = (header >> 19) & 0x3;
        const layerBits = (header >> 17) & 0x3;
        const bitrateIndex = (header >> 12) & 0xf;
        const sampleRateIndex = (header >> 10) & 0x3;
        const padding = ((header >> 9) & 0x1);
        const version = this.decodeVersion(versionBits);
        const layer = this.decodeLayer(layerBits);
        if (!version || !layer) {
            return null;
        }
        if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
            return null;
        }
        const bitrate = Mp3Parser.BITRATE_INDEX[version][layer][bitrateIndex];
        const sampleRate = Mp3Parser.SAMPLE_RATE_INDEX[version][sampleRateIndex];
        if (!bitrate || !sampleRate) {
            return null;
        }
        const samplesPerFrame = this.getSamplesPerFrame(version, layer);
        return {
            version,
            layer,
            bitrate,
            sampleRate,
            padding,
            samplesPerFrame
        };
    }
    decodeVersion(bits) {
        switch (bits) {
            case 0b11:
                return 1;
            case 0b10:
                return 2;
            case 0b00:
                return 25;
            default:
                return null;
        }
    }
    decodeLayer(bits) {
        switch (bits) {
            case 0b11:
                return 1;
            case 0b10:
                return 2;
            case 0b01:
                return 3;
            default:
                return null;
        }
    }
    getSamplesPerFrame(version, layer) {
        if (layer === 1) {
            return 384;
        }
        if (layer === 2) {
            return 1152;
        }
        return version === 1 ? 1152 : 576;
    }
}
exports.Mp3Parser = Mp3Parser;
Object.defineProperty(Mp3Parser, "BITRATE_INDEX", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: {
        1: {
            1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
            2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
            3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
        },
        2: {
            1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
            2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
            3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
        },
        25: {
            1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
            2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
            3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
        }
    }
});
Object.defineProperty(Mp3Parser, "SAMPLE_RATE_INDEX", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: {
        1: [44100, 48000, 32000],
        2: [22050, 24000, 16000],
        25: [11025, 12000, 8000]
    }
});
//# sourceMappingURL=Mp3Parser.js.map