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
//# sourceMappingURL=HlsStreamerErrors.d.ts.map