"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalFileProvider = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const HlsStreamerErrors_1 = require("../errors/HlsStreamerErrors");
class LocalFileProvider {
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
        if (!node_fs_1.default.existsSync(this.filePath)) {
            throw new HlsStreamerErrors_1.FileNotFoundError(this.filePath);
        }
        const stat = node_fs_1.default.statSync(this.filePath);
        if (!stat.isFile()) {
            throw new HlsStreamerErrors_1.InvalidFileError('Path is not a file');
        }
    }
    async getSize() {
        const stat = await node_fs_1.default.promises.stat(this.filePath);
        return stat.size;
    }
    async getRange(start, end) {
        const length = end - start;
        if (length === 0)
            return Buffer.alloc(0);
        const fd = node_fs_1.default.openSync(this.filePath, 'r');
        try {
            const buffer = Buffer.alloc(length);
            const bytesRead = node_fs_1.default.readSync(fd, buffer, 0, length, start);
            return buffer.subarray(0, bytesRead);
        }
        finally {
            node_fs_1.default.closeSync(fd);
        }
    }
    async getHeader() {
        return this.getRange(0, 64);
    }
    async getBuffer() {
        return node_fs_1.default.promises.readFile(this.filePath);
    }
}
exports.LocalFileProvider = LocalFileProvider;
//# sourceMappingURL=LocalFileProvider.js.map