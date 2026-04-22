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
export class UnsupportedFormatError extends HlsStreamerError {
    constructor(format) {
        super(`Unsupported media format: ${format}`);
        this.name = 'UnsupportedFormatError';
    }
}
export class StorageProviderError extends HlsStreamerError {
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
//# sourceMappingURL=HlsStreamerErrors.js.map