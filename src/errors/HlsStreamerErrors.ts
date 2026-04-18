/**
 * Base error class for HLS streamer errors
 */
export class HlsStreamerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HlsStreamerError';
  }
}

/**
 * Thrown when specified file does not exist
 */
export class FileNotFoundError extends HlsStreamerError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Thrown when file is invalid or unsupported
 */
export class InvalidFileError extends HlsStreamerError {
  constructor(message: string) {
    super(`Invalid file: ${message}`);
    this.name = 'InvalidFileError';
  }
}

/**
 * Thrown when byte range parameters are invalid
 */
export class InvalidRangeError extends HlsStreamerError {
  constructor(startByte: number, endByte: number) {
    super(`Invalid range: start=${startByte}, end=${endByte}`);
    this.name = 'InvalidRangeError';
  }
}

/**
 * Thrown when configuration parameters are invalid
 */
export class InvalidParameterError extends HlsStreamerError {
  constructor(parameter: string, value: any) {
    super(`Invalid parameter '${parameter}': ${value}`);
    this.name = 'InvalidParameterError';
  }
}

/**
 * Thrown when the media format is not supported
 */
export class UnsupportedFormatError extends HlsStreamerError {
  constructor(format: string) {
    super(`Unsupported media format: ${format}`);
    this.name = 'UnsupportedFormatError';
  }
}