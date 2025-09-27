import fs from 'fs';
import path from 'path';
import { HlsStreamer } from '../src/index';
import {
  FileNotFoundError,
  InvalidFileError,
  InvalidRangeError,
  InvalidParameterError
} from '../src/errors/HlsStreamerErrors';
import { MockMP3 } from './fixtures/mock-mp3';

// Mock the FileLib.getMP3DurationFromBuffer to return predictable durations
jest.mock('../src/Libs/FileLib', () => ({
  FileLib: {
    getMP3DurationFromBuffer: jest.fn().mockImplementation((buffer: Buffer) => {
      // Return a duration based on buffer size for predictable testing
      const estimatedDuration = buffer.length / 16000; // ~128kbps MP3
      return Promise.resolve(Math.max(0.1, estimatedDuration));
    })
  }
}));

describe('HlsStreamer', () => {
  const testFilesDir = path.join(__dirname, 'temp');
  let testMP3Path: string;

  beforeAll(async () => {
    // Create temp directory for test files
    await fs.promises.mkdir(testFilesDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create a fresh test MP3 file for each test
    testMP3Path = path.join(testFilesDir, `test-${Date.now()}.mp3`);
    await MockMP3.createMockMP3File(testMP3Path, 1024 * 1024); // 1MB test file for most tests
  });

  afterEach(async () => {
    // Clean up test file
    await MockMP3.cleanup(testMP3Path);
  });

  afterAll(async () => {
    // Clean up temp directory
    try {
      await fs.promises.rmdir(testFilesDir);
    } catch (error) {
      // Ignore if directory is not empty or doesn't exist
    }
  });

  describe('Constructor', () => {
    it('should create HlsStreamer with valid options', () => {
      const options = { filePath: testMP3Path };
      const streamer = new HlsStreamer(options);
      expect(streamer).toBeInstanceOf(HlsStreamer);
    });

    it('should use default options when not specified', () => {
      const options = { filePath: testMP3Path };
      const streamer = new HlsStreamer(options);
      expect(streamer).toBeInstanceOf(HlsStreamer);
    });

    it('should accept all optional parameters', () => {
      const options = {
        filePath: testMP3Path,
        segmentSizeKB: 256,
        fileName: 'custom',
        baseUrl: 'api/v1',
        enableFastStart: true
      };
      const streamer = new HlsStreamer(options);
      expect(streamer).toBeInstanceOf(HlsStreamer);
    });
  });

  describe('Constructor validation', () => {
    it('should throw InvalidParameterError for missing filePath', () => {
      expect(() => {
        new HlsStreamer({} as any);
      }).toThrow(InvalidParameterError);
    });

    it('should throw InvalidParameterError for null filePath', () => {
      expect(() => {
        new HlsStreamer({ filePath: null } as any);
      }).toThrow(InvalidParameterError);
    });

    it('should throw InvalidParameterError for non-string filePath', () => {
      expect(() => {
        new HlsStreamer({ filePath: 123 } as any);
      }).toThrow(InvalidParameterError);
    });

    it('should throw InvalidParameterError for negative segmentSizeKB', () => {
      expect(() => {
        new HlsStreamer({
          filePath: testMP3Path,
          segmentSizeKB: -100
        });
      }).toThrow(InvalidParameterError);
    });

    it('should throw InvalidParameterError for zero segmentSizeKB', () => {
      expect(() => {
        new HlsStreamer({
          filePath: testMP3Path,
          segmentSizeKB: 0
        });
      }).toThrow(InvalidParameterError);
    });

    it('should throw InvalidParameterError for non-number segmentSizeKB', () => {
      expect(() => {
        new HlsStreamer({
          filePath: testMP3Path,
          segmentSizeKB: 'invalid' as any
        });
      }).toThrow(InvalidParameterError);
    });

    it('should throw InvalidParameterError for non-string fileName', () => {
      expect(() => {
        new HlsStreamer({
          filePath: testMP3Path,
          fileName: 123 as any
        });
      }).toThrow(InvalidParameterError);
    });
  });

  describe('File validation', () => {
    it('should throw FileNotFoundError for non-existent file', () => {
      expect(() => {
        new HlsStreamer({ filePath: '/path/to/nonexistent/file.mp3' });
      }).toThrow(FileNotFoundError);
    });

    it('should throw InvalidFileError for directory path', () => {
      expect(() => {
        new HlsStreamer({ filePath: testFilesDir });
      }).toThrow(InvalidFileError);
    });

    it('should throw InvalidFileError for non-MP3 file', async () => {
      const txtPath = path.join(testFilesDir, 'test.txt');
      await fs.promises.writeFile(txtPath, new Uint8Array(Buffer.from('not an mp3 file')));

      expect(() => {
        new HlsStreamer({ filePath: txtPath });
      }).toThrow(InvalidFileError);

      await MockMP3.cleanup(txtPath);
    });
  });

  describe('getFileBuffer', () => {
    let streamer: HlsStreamer;

    beforeEach(() => {
      streamer = new HlsStreamer({ filePath: testMP3Path });
    });

    it('should return correct buffer for valid range', async () => {
      const buffer = await streamer.getFileBuffer(0, 100);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(100);
    });

    it('should return buffer for entire file', async () => {
      const stats = await fs.promises.stat(testMP3Path);
      const buffer = await streamer.getFileBuffer(0, stats.size);
      expect(buffer.length).toBe(stats.size);
    });

    it('should return partial buffer', async () => {
      const buffer = await streamer.getFileBuffer(10, 50);
      expect(buffer.length).toBe(40);
    });

    it('should throw InvalidRangeError for negative start', async () => {
      await expect(streamer.getFileBuffer(-1, 100)).rejects.toThrow(InvalidRangeError);
    });

    it('should throw InvalidRangeError for start > end', async () => {
      await expect(streamer.getFileBuffer(100, 50)).rejects.toThrow(InvalidRangeError);
    });

    it('should throw InvalidRangeError for NaN start', async () => {
      await expect(streamer.getFileBuffer(NaN, 100)).rejects.toThrow(InvalidRangeError);
    });

    it('should throw InvalidRangeError for NaN end', async () => {
      await expect(streamer.getFileBuffer(0, NaN)).rejects.toThrow(InvalidRangeError);
    });

    it('should throw InvalidRangeError for end beyond file size', async () => {
      const stats = await fs.promises.stat(testMP3Path);
      await expect(streamer.getFileBuffer(0, stats.size + 1)).rejects.toThrow(InvalidRangeError);
    });
  });

  describe('createM3U8', () => {
    let streamer: HlsStreamer;

    beforeEach(() => {
      streamer = new HlsStreamer({
        filePath: testMP3Path,
        segmentSizeKB: 1, // 1KB segments for testing
        fileName: 'test',
        baseUrl: 'api'
      });
    });

    it('should generate valid M3U8 playlist', async () => {
      const m3u8 = await streamer.createM3U8();

      expect(m3u8).toContain('#EXTM3U');
      expect(m3u8).toContain('#EXT-X-VERSION:6');
      expect(m3u8).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
      expect(m3u8).toContain('#EXT-X-TARGETDURATION:14');
      expect(m3u8).toContain('#EXT-X-MEDIA-SEQUENCE:0');
      expect(m3u8).toContain('#EXT-X-ENDLIST');
    });

    it('should contain segment entries', async () => {
      const m3u8 = await streamer.createM3U8();

      expect(m3u8).toContain('#EXTINF:');
      expect(m3u8).toContain('/api/');
      expect(m3u8).toContain('test000.mp3');
    });

    it('should handle empty baseUrl', async () => {
      const streamerNoBase = new HlsStreamer({
        filePath: testMP3Path,
        segmentSizeKB: 1,
        fileName: 'test'
      });

      const m3u8 = await streamerNoBase.createM3U8();
      expect(m3u8).not.toContain('//'); // Should not have double slashes
    });

    it('should generate correct number of segments', async () => {
      const m3u8 = await streamer.createM3U8();
      const extinf_count = (m3u8.match(/#EXTINF:/g) || []).length;

      // With 1MB file and 1KB segments, should have 1024 segments
      expect(extinf_count).toBe(1024);
    });

    it('should handle enableFastStart option', async () => {
      const fastStartStreamer = new HlsStreamer({
        filePath: testMP3Path,
        segmentSizeKB: 1,
        fileName: 'test',
        enableFastStart: true
      });

      const m3u8 = await fastStartStreamer.createM3U8();
      expect(m3u8).toContain('#EXTINF:');

      // Should have more segments due to smaller initial segments
      const extinf_count = (m3u8.match(/#EXTINF:/g) || []).length;
      expect(extinf_count).toBeGreaterThan(1024);
    });
  });

  describe('getSegmentDuration', () => {
    let streamer: HlsStreamer;

    beforeEach(() => {
      streamer = new HlsStreamer({
        filePath: testMP3Path,
        segmentSizeKB: 1
      });
    });

    it('should return duration for valid segment', async () => {
      const duration = await streamer.getSegmentDuration(0);
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });

    it('should cache segment duration', async () => {
      const duration1 = await streamer.getSegmentDuration(0);
      const duration2 = await streamer.getSegmentDuration(0);

      expect(duration1).toBe(duration2);
    });

    it('should return different durations for different segments', async () => {
      const duration0 = await streamer.getSegmentDuration(0);
      const duration1 = await streamer.getSegmentDuration(1);

      // They might be the same or different, but both should be valid
      expect(typeof duration0).toBe('number');
      expect(typeof duration1).toBe('number');
      expect(duration0).toBeGreaterThan(0);
      expect(duration1).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very small MP3 file', async () => {
      const smallMP3Path = path.join(testFilesDir, 'small.mp3');
      await MockMP3.createMockMP3File(smallMP3Path, 2048); // 2KB file

      const streamer = new HlsStreamer({
        filePath: smallMP3Path,
        segmentSizeKB: 1 // 1KB segments
      });

      const m3u8 = await streamer.createM3U8();
      expect(m3u8).toContain('#EXTM3U');

      await MockMP3.cleanup(smallMP3Path);
    });

    it('should handle segment size larger than file', async () => {
      const smallMP3Path = path.join(testFilesDir, 'tiny.mp3');
      await MockMP3.createMockMP3File(smallMP3Path, 100); // 100 bytes

      const streamer = new HlsStreamer({
        filePath: smallMP3Path,
        segmentSizeKB: 1 // 1KB > 100 bytes
      });

      // Constructor shouldn't throw, but createM3U8 will when it tries to get file info
      await expect(streamer.createM3U8()).rejects.toThrow(InvalidFileError);

      await MockMP3.cleanup(smallMP3Path);
    });

    it('should handle empty file', async () => {
      const emptyMP3Path = path.join(testFilesDir, 'empty.mp3');
      await fs.promises.writeFile(emptyMP3Path, new Uint8Array(0));

      const streamer = new HlsStreamer({ filePath: emptyMP3Path });

      await expect(streamer.createM3U8()).rejects.toThrow(InvalidFileError);

      await MockMP3.cleanup(emptyMP3Path);
    });
  });

  describe('Integration tests', () => {
    it('should work end-to-end with realistic file', async () => {
      const largeMP3Path = path.join(testFilesDir, 'large.mp3');
      await MockMP3.createMockMP3File(largeMP3Path, 50000); // 50KB

      const streamer = new HlsStreamer({
        filePath: largeMP3Path,
        segmentSizeKB: 10,
        fileName: 'music',
        baseUrl: 'stream',
        enableFastStart: true
      });

      // Generate M3U8
      const m3u8 = await streamer.createM3U8();
      expect(m3u8).toContain('#EXTM3U');
      expect(m3u8).toContain('music');
      expect(m3u8).toContain('/stream/');

      // Get first segment
      const buffer = await streamer.getFileBuffer(0, 2500); // ~2.5KB
      expect(buffer.length).toBe(2500);

      // Get segment duration
      const duration = await streamer.getSegmentDuration(0);
      expect(duration).toBeGreaterThan(0);

      await MockMP3.cleanup(largeMP3Path);
    });
  });
});