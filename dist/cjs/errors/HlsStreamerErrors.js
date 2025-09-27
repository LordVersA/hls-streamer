"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidParameterError = exports.InvalidRangeError = exports.InvalidFileError = exports.FileNotFoundError = exports.HlsStreamerError = void 0;
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
//# sourceMappingURL=HlsStreamerErrors.js.map