export class HlsStreamerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HlsStreamerError';
    }
}
export class FileNotFoundError extends HlsStreamerError {
    constructor(filePath) {
        super(`File not found: ${filePath}`);
        this.name = 'FileNotFoundError';
    }
}
export class InvalidFileError extends HlsStreamerError {
    constructor(message) {
        super(`Invalid file: ${message}`);
        this.name = 'InvalidFileError';
    }
}
export class InvalidRangeError extends HlsStreamerError {
    constructor(startByte, endByte) {
        super(`Invalid range: start=${startByte}, end=${endByte}`);
        this.name = 'InvalidRangeError';
    }
}
export class InvalidParameterError extends HlsStreamerError {
    constructor(parameter, value) {
        super(`Invalid parameter '${parameter}': ${value}`);
        this.name = 'InvalidParameterError';
    }
}
//# sourceMappingURL=HlsStreamerErrors.js.map