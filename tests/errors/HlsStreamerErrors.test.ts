import {
  HlsStreamerError,
  FileNotFoundError,
  InvalidFileError,
  InvalidRangeError,
  InvalidParameterError
} from '../../src/errors/HlsStreamerErrors';

describe('HlsStreamerErrors', () => {
  describe('HlsStreamerError', () => {
    it('should create error with correct message and name', () => {
      const message = 'Test error message';
      const error = new HlsStreamerError(message);

      expect(error.message).toBe(message);
      expect(error.name).toBe('HlsStreamerError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HlsStreamerError);
    });
  });

  describe('FileNotFoundError', () => {
    it('should create error with correct message and name', () => {
      const filePath = '/path/to/missing/file.mp3';
      const error = new FileNotFoundError(filePath);

      expect(error.message).toBe(`File not found: ${filePath}`);
      expect(error.name).toBe('FileNotFoundError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HlsStreamerError);
      expect(error).toBeInstanceOf(FileNotFoundError);
    });

    it('should handle empty file path', () => {
      const error = new FileNotFoundError('');
      expect(error.message).toBe('File not found: ');
    });
  });

  describe('InvalidFileError', () => {
    it('should create error with correct message and name', () => {
      const message = 'File is not a valid MP3';
      const error = new InvalidFileError(message);

      expect(error.message).toBe(`Invalid file: ${message}`);
      expect(error.name).toBe('InvalidFileError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HlsStreamerError);
      expect(error).toBeInstanceOf(InvalidFileError);
    });

    it('should handle empty message', () => {
      const error = new InvalidFileError('');
      expect(error.message).toBe('Invalid file: ');
    });
  });

  describe('InvalidRangeError', () => {
    it('should create error with correct message and name', () => {
      const startByte = 100;
      const endByte = 50;
      const error = new InvalidRangeError(startByte, endByte);

      expect(error.message).toBe(`Invalid range: start=${startByte}, end=${endByte}`);
      expect(error.name).toBe('InvalidRangeError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HlsStreamerError);
      expect(error).toBeInstanceOf(InvalidRangeError);
    });

    it('should handle zero values', () => {
      const error = new InvalidRangeError(0, 0);
      expect(error.message).toBe('Invalid range: start=0, end=0');
    });

    it('should handle negative values', () => {
      const error = new InvalidRangeError(-10, -5);
      expect(error.message).toBe('Invalid range: start=-10, end=-5');
    });
  });

  describe('InvalidParameterError', () => {
    it('should create error with correct message and name', () => {
      const parameter = 'segmentSize';
      const value = -100;
      const error = new InvalidParameterError(parameter, value);

      expect(error.message).toBe(`Invalid parameter '${parameter}': ${value}`);
      expect(error.name).toBe('InvalidParameterError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HlsStreamerError);
      expect(error).toBeInstanceOf(InvalidParameterError);
    });

    it('should handle null value', () => {
      const error = new InvalidParameterError('testParam', null);
      expect(error.message).toBe("Invalid parameter 'testParam': null");
    });

    it('should handle undefined value', () => {
      const error = new InvalidParameterError('testParam', undefined);
      expect(error.message).toBe("Invalid parameter 'testParam': undefined");
    });

    it('should handle object value', () => {
      const value = { test: 'object' };
      const error = new InvalidParameterError('testParam', value);
      expect(error.message).toBe("Invalid parameter 'testParam': [object Object]");
    });
  });
});