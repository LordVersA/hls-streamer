import fs from 'fs';
import path from 'path';
import { LocalFileProvider } from '../../src/Providers/LocalFileProvider';
import { FileNotFoundError, InvalidFileError } from '../../src/errors/HlsStreamerErrors';
import { MockMP3 } from '../fixtures/mock-mp3';

describe('LocalFileProvider', () => {
  const testDir = path.join(__dirname, 'temp');
  let testFilePath: string;

  beforeAll(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  beforeEach(async () => {
    testFilePath = path.join(testDir, `test-${Date.now()}.mp3`);
    await MockMP3.createMockMP3File(testFilePath, 1024);
  });

  afterEach(async () => {
    await MockMP3.cleanup(testFilePath);
  });

  afterAll(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should set resourceId to filePath', () => {
      const provider = new LocalFileProvider(testFilePath);
      expect(provider.resourceId).toBe(testFilePath);
    });
  });

  describe('validateSync', () => {
    it('should not throw for a valid file', () => {
      const provider = new LocalFileProvider(testFilePath);
      expect(() => provider.validateSync()).not.toThrow();
    });

    it('should throw FileNotFoundError for missing file', () => {
      const provider = new LocalFileProvider('/nonexistent/file.mp3');
      expect(() => provider.validateSync()).toThrow(FileNotFoundError);
    });

    it('should throw InvalidFileError for a directory', async () => {
      const provider = new LocalFileProvider(testDir);
      expect(() => provider.validateSync()).toThrow(InvalidFileError);
    });
  });

  describe('getSize', () => {
    it('should return the correct file size', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const size = await provider.getSize();
      const stat = await fs.promises.stat(testFilePath);
      expect(size).toBe(stat.size);
    });
  });

  describe('getBuffer', () => {
    it('should return the full file contents', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const buffer = await provider.getBuffer();
      const expected = await fs.promises.readFile(testFilePath);
      expect(buffer).toEqual(expected);
    });

    it('should return a Buffer instance', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const buffer = await provider.getBuffer();
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('getHeader', () => {
    it('should return the first 64 bytes', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const header = await provider.getHeader();
      const full = await fs.promises.readFile(testFilePath);
      expect(header).toEqual(full.subarray(0, 64));
    });

    it('should return a Buffer of at most 64 bytes', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const header = await provider.getHeader();
      expect(header.length).toBeLessThanOrEqual(64);
    });
  });

  describe('getRange', () => {
    it('should return correct bytes for a given range', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const full = await fs.promises.readFile(testFilePath);
      const slice = await provider.getRange(10, 50);
      expect(slice).toEqual(full.subarray(10, 50));
    });

    it('should return empty buffer for zero-length range', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const slice = await provider.getRange(10, 10);
      expect(slice.length).toBe(0);
    });

    it('should return correct bytes at file start', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const full = await fs.promises.readFile(testFilePath);
      const slice = await provider.getRange(0, 4);
      expect(slice).toEqual(full.subarray(0, 4));
    });

    it('should return correct bytes at file end', async () => {
      const provider = new LocalFileProvider(testFilePath);
      const size = await provider.getSize();
      const full = await fs.promises.readFile(testFilePath);
      const slice = await provider.getRange(size - 10, size);
      expect(slice).toEqual(full.subarray(size - 10, size));
    });
  });
});
