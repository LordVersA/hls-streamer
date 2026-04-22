"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageProviderError = exports.UnsupportedFormatError = exports.InvalidParameterError = exports.InvalidRangeError = exports.InvalidFileError = exports.FileNotFoundError = exports.HlsStreamerError = void 0;
class HlsStreamerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HlsStreamerError';
    }
}
exports.HlsStreamerError = HlsStreamerError;
class FileNotFoundError extends HlsStreamerError {
    constructor(filePath) {
        super(`File not found: ${filePath}`);
        this.name = 'FileNotFoundError';
    }
}
exports.FileNotFoundError = FileNotFoundError;
class InvalidFileError extends HlsStreamerError {
    constructor(message) {
        super(`Invalid file: ${message}`);
        this.name = 'InvalidFileError';
    }
}
exports.InvalidFileError = InvalidFileError;
class InvalidRangeError extends HlsStreamerError {
    constructor(startByte, endByte) {
        super(`Invalid range: start=${startByte}, end=${endByte}`);
        this.name = 'InvalidRangeError';
    }
}
exports.InvalidRangeError = InvalidRangeError;
class InvalidParameterError extends HlsStreamerError {
    constructor(parameter, value) {
        super(`Invalid parameter '${parameter}': ${value}`);
        this.name = 'InvalidParameterError';
    }
}
exports.InvalidParameterError = InvalidParameterError;
class UnsupportedFormatError extends HlsStreamerError {
    constructor(format) {
        super(`Unsupported media format: ${format}`);
        this.name = 'UnsupportedFormatError';
    }
}
exports.UnsupportedFormatError = UnsupportedFormatError;
class StorageProviderError extends HlsStreamerError {
    constructor(message, resourceId) {
        super(`Storage provider error${resourceId ? ` for ${resourceId}` : ''}: ${message}`);
        Object.defineProperty(this, "resourceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: resourceId
        });
        this.name = 'StorageProviderError';
    }
}
exports.StorageProviderError = StorageProviderError;
//# sourceMappingURL=HlsStreamerErrors.js.map