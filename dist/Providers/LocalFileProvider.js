import fs from 'node:fs';
import { FileNotFoundError, InvalidFileError } from '../errors/HlsStreamerErrors';
export class LocalFileProvider {
    constructor(filePath) {
        Object.defineProperty(this, "filePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: filePath
        });
        Object.defineProperty(this, "resourceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.resourceId = filePath;
    }
    validateSync() {
        if (!fs.existsSync(this.filePath)) {
            throw new FileNotFoundError(this.filePath);
        }
        const stat = fs.statSync(this.filePath);
        if (!stat.isFile()) {
            throw new InvalidFileError('Path is not a file');
        }
    }
    async getSize() {
        const stat = await fs.promises.stat(this.filePath);
        return stat.size;
    }
    async getRange(start, end) {
        const length = end - start;
        if (length === 0)
            return Buffer.alloc(0);
        const fd = fs.openSync(this.filePath, 'r');
        try {
            const buffer = Buffer.alloc(length);
            const bytesRead = fs.readSync(fd, buffer, 0, length, start);
            return buffer.subarray(0, bytesRead);
        }
        finally {
            fs.closeSync(fd);
        }
    }
    async getHeader() {
        return this.getRange(0, 64);
    }
    async getBuffer() {
        return fs.promises.readFile(this.filePath);
    }
}
//# sourceMappingURL=LocalFileProvider.js.map