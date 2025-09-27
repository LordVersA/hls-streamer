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
        Object.defineProperty(this, "fileInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "segmentCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.validateOptions(options);
        this.validateFile(options.filePath);
        this.filePath = options.filePath;
        this.segmentSize = (options.segmentSizeKB ?? 512) * 1024;
        this.fileName = options.fileName ?? "file";
        this.baseUrl = options.baseUrl ?? "";
        this.enableFastStart = options.enableFastStart ?? false;
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
    validateFile(filePath) {
        if (!node_fs_1.default.existsSync(filePath)) {
            throw new HlsStreamerErrors_1.FileNotFoundError(filePath);
        }
        const stat = node_fs_1.default.statSync(filePath);
        if (!stat.isFile()) {
            throw new HlsStreamerErrors_1.InvalidFileError('Path is not a file');
        }
        const ext = node_path_1.default.extname(filePath).toLowerCase();
        if (ext !== '.mp3') {
            throw new HlsStreamerErrors_1.InvalidFileError('Only MP3 files are supported');
        }
    }
    async getFileInfo() {
        if (!this.fileInfo) {
            const stat = await node_fs_1.default.promises.stat(this.filePath);
            const size = stat.size;
            if (size <= 0) {
                throw new HlsStreamerErrors_1.InvalidFileError('File is empty');
            }
            if (this.segmentSize > size) {
                throw new HlsStreamerErrors_1.InvalidFileError('Segment size is larger than file size');
            }
            this.fileInfo = {
                size,
                duration: 0
            };
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
        const bufferLength = endByte - startByte;
        const fd = node_fs_1.default.openSync(this.filePath, "r");
        try {
            const buffer = Buffer.alloc(bufferLength);
            const bytesRead = node_fs_1.default.readSync(fd, buffer, 0, bufferLength, startByte);
            return buffer.subarray(0, bytesRead);
        }
        finally {
            node_fs_1.default.closeSync(fd);
        }
    }
    async createM3U8() {
        const fileInfo = await this.getFileInfo();
        const segmentCount = this.calculateSegmentCount(fileInfo.size);
        const m3u8 = [
            '#EXTM3U',
            '#EXT-X-VERSION:6',
            '#EXT-X-PLAYLIST-TYPE:VOD',
            '#EXT-X-TARGETDURATION:14',
            '#EXT-X-MEDIA-SEQUENCE:0',
        ];
        for (let i = 0; i < segmentCount; i++) {
            const { start, end } = this.calculateSegment(i, fileInfo.size);
            const estimatedDuration = this.estimateSegmentDuration(end - start);
            const segmentUrl = this.buildSegmentUrl(start, end, i);
            m3u8.push(`#EXTINF:${estimatedDuration.toFixed(3)}`);
            m3u8.push(segmentUrl);
        }
        m3u8.push('#EXT-X-ENDLIST');
        return m3u8.join('\n');
    }
    calculateSegmentCount(fileSize) {
        if (!this.enableFastStart) {
            return Math.ceil(fileSize / this.segmentSize);
        }
        const firstTwoSegmentsSize = this.calculatefirst2SegmentSize();
        const remainingSize = fileSize - firstTwoSegmentsSize;
        return Math.ceil(remainingSize / this.segmentSize) + 2;
    }
    estimateSegmentDuration(segmentSize) {
        const estimatedBytesPerSecond = 16000;
        return segmentSize / estimatedBytesPerSecond;
    }
    buildSegmentUrl(start, end, index) {
        const baseUrlPrefix = this.baseUrl ? `/${this.baseUrl}` : '';
        return `${baseUrlPrefix}/${start}/${end}/${this.fileName}${this.padNumber(index, 3)}.mp3`;
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
    calculateSegment(segmentIndex, fileSize) {
        let start = 0;
        if (this.enableFastStart && segmentIndex < 2) {
            start = segmentIndex * (this.segmentSize / 4);
        }
        else if (this.enableFastStart) {
            start = (3 * this.segmentSize) / 4 + (segmentIndex - 2) * this.segmentSize;
        }
        else {
            start = segmentIndex * this.segmentSize;
        }
        const segmentSize = this.calculateSegmentSize(segmentIndex);
        const end = Math.min(start + segmentSize, fileSize);
        return { start: Math.floor(start), end: Math.floor(end) };
    }
    calculatefirst2SegmentSize() {
        return (this.segmentSize / 4) * 3;
    }
    padNumber(value, padding) {
        return value.toString().padStart(padding, '0');
    }
    async getSegmentDuration(segmentIndex) {
        const cachedSegment = this.segmentCache.get(segmentIndex);
        if (cachedSegment) {
            return cachedSegment.duration;
        }
        const fileInfo = await this.getFileInfo();
        const { start, end } = this.calculateSegment(segmentIndex, fileInfo.size);
        const segmentBuffer = await this.getFileBuffer(start, end);
        const duration = await FileLib_1.FileLib.getMP3DurationFromBuffer(segmentBuffer);
        this.segmentCache.set(segmentIndex, {
            start,
            end,
            duration
        });
        return duration;
    }
}
exports.HlsStreamer = HlsStreamer;
__exportStar(require("./Interfaces/HlsStreamer"), exports);
__exportStar(require("./errors/HlsStreamerErrors"), exports);
//# sourceMappingURL=index.js.map