"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HlsStreamer = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const FileLib_1 = require("./Libs/FileLib");
const FormatDetector_1 = require("./Libs/FormatDetector");
const HlsStreamerErrors_1 = require("./errors/HlsStreamerErrors");
class HlsStreamer {
    constructor(options) {
        Object.defineProperty(this, "filePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "segmentSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fileName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enableFastStart", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "formatOverride", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fileInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "segments", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.validateOptions(options);
        this.validateFile(options.filePath, options.format);
        this.filePath = options.filePath;
        this.segmentSize = (options.segmentSizeKB ?? 512) * 1024;
        this.fileName = options.fileName ?? "file";
        this.baseUrl = options.baseUrl ?? "";
        this.enableFastStart = options.enableFastStart ?? false;
        this.formatOverride = options.format || undefined;
    }
    validateOptions(options) {
        if (!options.filePath || typeof options.filePath !== 'string') {
            throw new HlsStreamerErrors_1.InvalidParameterError('filePath', options.filePath);
        }
        if (options.segmentSizeKB !== undefined &&
            (typeof options.segmentSizeKB !== 'number' || options.segmentSizeKB <= 0)) {
            throw new HlsStreamerErrors_1.InvalidParameterError('segmentSizeKB', options.segmentSizeKB);
        }
        if (options.fileName !== undefined && typeof options.fileName !== 'string') {
            throw new HlsStreamerErrors_1.InvalidParameterError('fileName', options.fileName);
        }
    }
    validateFile(filePath, format) {
        if (!node_fs_1.default.existsSync(filePath)) {
            throw new HlsStreamerErrors_1.FileNotFoundError(filePath);
        }
        const stat = node_fs_1.default.statSync(filePath);
        if (!stat.isFile()) {
            throw new HlsStreamerErrors_1.InvalidFileError('Path is not a file');
        }
        if (format) {
            const supportedFormats = ['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav'];
            if (!supportedFormats.includes(format.toLowerCase())) {
                throw new HlsStreamerErrors_1.UnsupportedFormatError(format);
            }
        }
        else {
            if (!FormatDetector_1.FormatDetector.isSupportedExtension(filePath)) {
                const fd = node_fs_1.default.openSync(filePath, 'r');
                try {
                    const header = new Uint8Array(64);
                    const bytesRead = node_fs_1.default.readSync(fd, header, 0, header.length, 0);
                    const detectedFormat = FormatDetector_1.FormatDetector.detectFormat(Buffer.from(header.subarray(0, bytesRead)));
                    if (!detectedFormat) {
                        const ext = node_path_1.default.extname(filePath);
                        throw new HlsStreamerErrors_1.UnsupportedFormatError(ext || 'unknown');
                    }
                }
                finally {
                    node_fs_1.default.closeSync(fd);
                }
            }
        }
    }
    async getFileInfo() {
        if (!this.fileInfo) {
            const analysis = await FileLib_1.FileLib.analyzeAudioFile(this.filePath, this.formatOverride);
            if (analysis.size <= 0) {
                throw new HlsStreamerErrors_1.InvalidFileError('File is empty');
            }
            this.fileInfo = analysis;
            this.segments = undefined;
        }
        return this.fileInfo;
    }
    async getFileBuffer(startByte, endByte) {
        if (isNaN(startByte) || isNaN(endByte) || startByte < 0 || endByte < startByte) {
            throw new HlsStreamerErrors_1.InvalidRangeError(startByte, endByte);
        }
        const fileInfo = await this.getFileInfo();
        if (endByte > fileInfo.size) {
            throw new HlsStreamerErrors_1.InvalidRangeError(startByte, endByte);
        }
        const length = endByte - startByte;
        const fd = node_fs_1.default.openSync(this.filePath, "r");
        try {
            if (length === 0) {
                return Buffer.alloc(0);
            }
            const buffer = Buffer.alloc(length);
            const bytesRead = node_fs_1.default.readSync(fd, buffer, 0, length, startByte);
            return buffer.subarray(0, bytesRead);
        }
        finally {
            node_fs_1.default.closeSync(fd);
        }
    }
    async createM3U8() {
        const [fileInfo, segments] = await Promise.all([
            this.getFileInfo(),
            this.getSegments()
        ]);
        if (!segments.length) {
            throw new HlsStreamerErrors_1.InvalidFileError('Unable to generate segments for MP3 file');
        }
        const maxSegmentDuration = segments.reduce((max, segment) => Math.max(max, segment.duration), 0);
        const targetDurationSeconds = Math.max(1, Math.ceil(maxSegmentDuration || fileInfo.duration || 1));
        const m3u8 = [
            '#EXTM3U',
            '#EXT-X-VERSION:6',
            '#EXT-X-PLAYLIST-TYPE:VOD',
            `#EXT-X-TARGETDURATION:${targetDurationSeconds}`,
            '#EXT-X-MEDIA-SEQUENCE:0',
        ];
        segments.forEach((segment, index) => {
            const segmentUrl = this.buildSegmentUrl(segment.start, segment.end, index);
            m3u8.push(`#EXTINF:${segment.duration.toFixed(3)},`);
            m3u8.push(segmentUrl);
        });
        m3u8.push('#EXT-X-ENDLIST');
        return m3u8.join('\n');
    }
    async getSegments() {
        if (this.segments) {
            return this.segments;
        }
        const fileInfo = await this.getFileInfo();
        if (!fileInfo.frames.length) {
            this.segments = this.buildSegmentsWithoutFrameTable(fileInfo);
            return this.segments;
        }
        const targetSizes = this.computeTargetSizes(fileInfo);
        const segments = [];
        const frames = fileInfo.frames;
        let frameCursor = 0;
        const consumeFrames = (targetBytes) => {
            if (frameCursor >= frames.length) {
                return;
            }
            const startFrameIndex = frameCursor;
            let consumedBytes = 0;
            let duration = 0;
            while (frameCursor < frames.length) {
                const frame = frames[frameCursor];
                const nextBytes = consumedBytes + frame.length;
                if (consumedBytes > 0 && nextBytes > targetBytes) {
                    break;
                }
                consumedBytes = nextBytes;
                duration += frame.duration;
                frameCursor++;
                if (consumedBytes >= targetBytes) {
                    break;
                }
            }
            if (frameCursor === startFrameIndex && frameCursor < frames.length) {
                const frame = frames[frameCursor];
                consumedBytes += frame.length;
                duration += frame.duration;
                frameCursor++;
            }
            if (frameCursor === startFrameIndex) {
                return;
            }
            const start = frames[startFrameIndex].offset;
            const lastFrame = frames[frameCursor - 1];
            const end = lastFrame.offset + lastFrame.length;
            segments.push({
                start,
                end,
                duration
            });
        };
        targetSizes.forEach(consumeFrames);
        while (frameCursor < frames.length) {
            consumeFrames(this.segmentSize);
        }
        if (!segments.length) {
            this.segments = this.buildSegmentsWithoutFrameTable(fileInfo);
        }
        else {
            this.segments = segments;
        }
        return this.segments;
    }
    computeTargetSizes(fileInfo) {
        const totalBytes = fileInfo.audioDataSize || fileInfo.size;
        return this.computeTargetSizesFromBytes(totalBytes);
    }
    computeTargetSizesFromBytes(totalBytes) {
        if (totalBytes <= 0) {
            return [];
        }
        const targets = [];
        let remaining = totalBytes;
        let index = 0;
        while (remaining > 0) {
            const targetSize = Math.min(this.calculateSegmentSize(index), remaining);
            targets.push(targetSize);
            remaining -= targetSize;
            index++;
        }
        return targets.length ? targets : [totalBytes];
    }
    buildSegmentsWithoutFrameTable(fileInfo) {
        const segments = [];
        const totalBytes = Math.max(fileInfo.size, fileInfo.audioDataSize);
        if (totalBytes <= 0) {
            return segments;
        }
        const targets = this.computeTargetSizesFromBytes(totalBytes);
        let start = 0;
        targets.forEach((targetSize) => {
            const end = Math.min(totalBytes, start + targetSize);
            const duration = this.estimateSegmentDuration(end - start, fileInfo);
            segments.push({ start, end, duration });
            start = end;
        });
        if (start < totalBytes) {
            const duration = this.estimateSegmentDuration(totalBytes - start, fileInfo);
            segments.push({ start, end: totalBytes, duration });
        }
        return segments;
    }
    estimateSegmentDuration(segmentSize, fileInfo) {
        if (fileInfo.duration > 0 && fileInfo.audioDataSize > 0) {
            const bytesPerSecond = fileInfo.audioDataSize / fileInfo.duration;
            return segmentSize / bytesPerSecond;
        }
        const estimatedBytesPerSecond = fileInfo.averageBitrate
            ? (fileInfo.averageBitrate * 1000) / 8
            : 16000;
        return segmentSize / estimatedBytesPerSecond;
    }
    buildSegmentUrl(start, end, index) {
        const baseUrlPrefix = this.baseUrl ? `/${this.baseUrl}` : '';
        const ext = this.fileInfo?.format || node_path_1.default.extname(this.filePath).toLowerCase().slice(1) || 'mp3';
        return `${baseUrlPrefix}/${start}/${end}/${this.fileName}${this.padNumber(index, 3)}.${ext}`;
    }
    calculateSegmentSize(segmentIndex) {
        if (!this.enableFastStart) {
            return this.segmentSize;
        }
        switch (segmentIndex) {
            case 0:
                return this.segmentSize / 4;
            case 1:
                return this.segmentSize / 2;
            default:
                return this.segmentSize;
        }
    }
    padNumber(value, padding) {
        return value.toString().padStart(padding, '0');
    }
    async getSegmentDuration(segmentIndex) {
        if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
            throw new HlsStreamerErrors_1.InvalidParameterError('segmentIndex', segmentIndex);
        }
        const segments = await this.getSegments();
        const segment = segments[segmentIndex];
        if (!segment) {
            throw new HlsStreamerErrors_1.InvalidParameterError('segmentIndex', segmentIndex);
        }
        return segment.duration;
    }
}
exports.HlsStreamer = HlsStreamer;
__exportStar(require("./Interfaces/HlsStreamer"), exports);
__exportStar(require("./errors/HlsStreamerErrors"), exports);
//# sourceMappingURL=index.js.map