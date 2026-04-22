export declare class HlsStreamerError extends Error {
    constructor(message: string);
}
export declare class FileNotFoundError extends HlsStreamerError {
    constructor(filePath: string);
}
export declare class InvalidFileError extends HlsStreamerError {
    constructor(message: string);
}
export declare class InvalidRangeError extends HlsStreamerError {
    constructor(startByte: number, endByte: number);
}
export declare class InvalidParameterError extends HlsStreamerError {
    constructor(parameter: string, value: any);
}
export declare class UnsupportedFormatError extends HlsStreamerError {
    constructor(format: string);
}
export declare class StorageProviderError extends HlsStreamerError {
    readonly resourceId?: string | undefined;
    constructor(message: string, resourceId?: string | undefined);
}
//# sourceMappingURL=HlsStreamerErrors.d.ts.map