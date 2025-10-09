import fs from "node:fs";
import path from "node:path";
import { FileLib } from "./Libs/FileLib";
import { FileNotFoundError, InvalidFileError, InvalidRangeError, InvalidParameterError } from "./errors/HlsStreamerErrors";
export class HlsStreamer {
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
        Object.defineProperty(this, "segments", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
            throw new InvalidParameterError('filePath', options.filePath);
        }
        if (options.segmentSizeKB !== undefined &&
            (typeof options.segmentSizeKB !== 'number' || options.segmentSizeKB <= 0)) {
            throw new InvalidParameterError('segmentSizeKB', options.segmentSizeKB);
        }
        if (options.fileName !== undefined && typeof options.fileName !== 'string') {
            throw new InvalidParameterError('fileName', options.fileName);
        }
    }
    validateFile(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new FileNotFoundError(filePath);
        }
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            throw new InvalidFileError('Path is not a file');
        }
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.mp3') {
            throw new InvalidFileError('Only MP3 files are supported');
        }
    }
    async getFileInfo() {
        if (!this.fileInfo) {
            const analysis = await FileLib.analyzeMP3File(this.filePath);
            if (analysis.size <= 0) {
                throw new InvalidFileError('File is empty');
            }
            this.fileInfo = analysis;
            this.segments = undefined;
        }
        return this.fileInfo;
    }
    async getFileBuffer(startByte, endByte) {
        if (isNaN(startByte) || isNaN(endByte) || startByte < 0 || endByte < startByte) {
            throw new InvalidRangeError(startByte, endByte);
        }
        const fileInfo = await this.getFileInfo();
        if (endByte > fileInfo.size) {
            throw new InvalidRangeError(startByte, endByte);
        }
        const length = endByte - startByte;
        const fd = fs.openSync(this.filePath, "r");
        try {
            if (length === 0) {
                return Buffer.alloc(0);
            }
            const buffer = Buffer.alloc(length);
            const bytesRead = fs.readSync(fd, buffer, 0, length, startByte);
            return buffer.subarray(0, bytesRead);
        }
        finally {
            fs.closeSync(fd);
        }
    }
    async createM3U8() {
        const [fileInfo, segments] = await Promise.all([
            this.getFileInfo(),
            this.getSegments()
        ]);
        if (!segments.length) {
            throw new InvalidFileError('Unable to generate segments for MP3 file');
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
            m3u8.push(`#EXTINF:${segment.duration.toFixed(3)}`);
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
            const duration = this.estimateSegmentDuration(end - start);
            segments.push({ start, end, duration });
            start = end;
        });
        if (start < totalBytes) {
            const duration = this.estimateSegmentDuration(totalBytes - start);
            segments.push({ start, end: totalBytes, duration });
        }
        return segments;
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
    padNumber(value, padding) {
        return value.toString().padStart(padding, '0');
    }
    async getSegmentDuration(segmentIndex) {
        if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
            throw new InvalidParameterError('segmentIndex', segmentIndex);
        }
        const segments = await this.getSegments();
        const segment = segments[segmentIndex];
        if (!segment) {
            throw new InvalidParameterError('segmentIndex', segmentIndex);
        }
        return segment.duration;
    }
}
export * from './Interfaces/HlsStreamer';
export * from './errors/HlsStreamerErrors';
//# sourceMappingURL=index.js.map