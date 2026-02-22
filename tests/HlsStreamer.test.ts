import fs from 'fs';
import path from 'path';
import { HlsStreamer } from '../src/index';
import { FileLib } from '../src/Libs/FileLib';
import {
  FileNotFoundError,
  InvalidFileError,
  InvalidRangeError,
  InvalidParameterError,
  UnsupportedFormatError
} from '../src/errors/HlsStreamerErrors';
import { MockMP3 } from './fixtures/mock-mp3';

const parseM3U8 = (playlist: string) => {
  const lines = playlist.split('\n').map((line) => line.trim()).filter(Boolean);
  const targetLine = lines.find((line) => line.startsWith('#EXT-X-TARGETDURATION:'));
  const targetDuration = targetLine ? parseInt(targetLine.split(':')[1]!, 10) : undefined;

  const durationLines = lines.filter((line) => line.startsWith('#EXTINF:'));
  const durations = durationLines.map((line) => {
    const numeric = line.replace('#EXTINF:', '').replace(',', '');
    return parseFloat(numeric);
  }).filter((value) => !Number.isNaN(value));

  const segmentUris = lines.filter((line) => !line.startsWith('#'));
  const segments = segmentUris.map((uri) => {
    const match = uri.match(/\/(\d+)\/(\d+)\/[^/]+$/);
    if (!match) {
      return { uri, start: NaN, end: NaN };
    }

    return {
      uri,
      start: Number(match[1]),
      end: Number(match[2])
    };
  });

  return {
    targetDuration,
    durations,
    segments
  };
};

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
    await fs.promises.rm(testFilesDir, { recursive: true, force: true });
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

    it('should throw UnsupportedFormatError for non-audio file', async () => {
      const txtPath = path.join(testFilesDir, 'test.txt');
      await fs.promises.writeFile(txtPath, new Uint8Array(Buffer.from('not an audio file')));

      expect(() => {
        new HlsStreamer({ filePath: txtPath });
      }).toThrow(UnsupportedFormatError);

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

    it('should generate valid playlist with accurate target duration', async () => {
      const m3u8 = await streamer.createM3U8();
      const { targetDuration, durations, segments } = parseM3U8(m3u8);

      expect(m3u8).toContain('#EXTM3U');
      expect(m3u8).toContain('#EXT-X-VERSION:6');
      expect(m3u8).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
      expect(m3u8).toContain('#EXT-X-MEDIA-SEQUENCE:0');
      expect(m3u8).toContain('#EXT-X-ENDLIST');

      expect(targetDuration).toBeGreaterThan(0);
      expect(durations.length).toBeGreaterThan(0);
      expect(durations.length).toBe(segments.length);

      const maxDuration = Math.max(...durations);
      expect(targetDuration).toBe(Math.ceil(maxDuration));

      segments.forEach((segment) => {
        expect(Number.isNaN(segment.start)).toBe(false);
        expect(Number.isNaN(segment.end)).toBe(false);
        expect(segment.end).toBeGreaterThan(segment.start);
      });

      const fileInfo = await FileLib.analyzeMP3File(testMP3Path);
      const lastFrame = fileInfo.frames[fileInfo.frames.length - 1];
      if (lastFrame) {
        const lastSegment = segments[segments.length - 1];
        expect(lastSegment?.end).toBe(lastFrame.offset + lastFrame.length);
      }
    });

    it('should include configured baseUrl and segment naming', async () => {
      const m3u8 = await streamer.createM3U8();
      expect(m3u8).toContain('/api/');
      expect(m3u8).toContain('test000.mp3');
    });

    it('should emit EXTINF lines with trailing comma for HLS compliance', async () => {
      const m3u8 = await streamer.createM3U8();
      const extinfLines = m3u8
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('#EXTINF:'));

      expect(extinfLines.length).toBeGreaterThan(0);
      extinfLines.forEach((line) => {
        expect(line.endsWith(',')).toBe(true);
      });
    });

    it('should handle empty baseUrl without double slashes', async () => {
      const streamerNoBase = new HlsStreamer({
        filePath: testMP3Path,
        segmentSizeKB: 1,
        fileName: 'test'
      });

      const m3u8 = await streamerNoBase.createM3U8();
      expect(m3u8).toContain('#EXTINF:');
      expect(m3u8).not.toContain('//test');
    });

    it('should adapt segment sizes when fast start is enabled', async () => {
      const baseline = parseM3U8(await streamer.createM3U8());

      const fastStartStreamer = new HlsStreamer({
        filePath: testMP3Path,
        segmentSizeKB: 1,
        fileName: 'test',
        enableFastStart: true
      });

      const fastStart = parseM3U8(await fastStartStreamer.createM3U8());

      expect(fastStart.segments.length).toBeGreaterThanOrEqual(baseline.segments.length);
      expect(fastStart.durations[0]).toBeLessThanOrEqual(baseline.durations[0]);
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

    it('should return duration matching playlist metadata', async () => {
      const playlist = parseM3U8(await streamer.createM3U8());
      const duration = await streamer.getSegmentDuration(0);

      expect(duration).toBeCloseTo(playlist.durations[0]!, 3);
    });

    it('should return valid durations for subsequent segments', async () => {
      const duration0 = await streamer.getSegmentDuration(0);
      const duration1 = await streamer.getSegmentDuration(1);

      expect(duration0).toBeGreaterThan(0);
      expect(duration1).toBeGreaterThan(0);
    });

    it('should reject invalid segment indices', async () => {
      await expect(streamer.getSegmentDuration(-1)).rejects.toThrow(InvalidParameterError);
      await expect(streamer.getSegmentDuration(99999)).rejects.toThrow(InvalidParameterError);
    });
  });

  describe('Edge cases', () => {
    it('should support extensionless files when content is a supported format', async () => {
      const extensionlessPath = path.join(testFilesDir, `extensionless-${Date.now()}`);
      await MockMP3.createMockMP3File(extensionlessPath, 4096);

      const streamer = new HlsStreamer({
        filePath: extensionlessPath,
        segmentSizeKB: 1
      });

      const m3u8 = await streamer.createM3U8();
      expect(m3u8).toContain('#EXTM3U');

      await MockMP3.cleanup(extensionlessPath);
    });

    it('should handle very small MP3 file', async () => {
      const smallMP3Path = path.join(testFilesDir, 'small.mp3');
      await MockMP3.createMockMP3File(smallMP3Path, 2048); // 2KB file

      const streamer = new HlsStreamer({
        filePath: smallMP3Path,
        segmentSizeKB: 1 // 1KB segments
      });

      const m3u8 = await streamer.createM3U8();
      const parsed = parseM3U8(m3u8);
      expect(parsed.segments.length).toBeGreaterThan(0);
      expect(parsed.durations.length).toBeGreaterThan(0);
      expect(parsed.durations[0]).toBeGreaterThan(0);

      await MockMP3.cleanup(smallMP3Path);
    });

    it('should handle segment size larger than file', async () => {
      const smallMP3Path = path.join(testFilesDir, 'tiny.mp3');
      await MockMP3.createMockMP3File(smallMP3Path, 100); // 100 bytes

      const streamer = new HlsStreamer({
        filePath: smallMP3Path,
        segmentSizeKB: 1 // 1KB > 100 bytes
      });

      const m3u8 = await streamer.createM3U8();
      const parsed = parseM3U8(m3u8);

      expect(parsed.segments.length).toBe(1);
      expect(parsed.durations.length).toBe(1);
      expect(parsed.durations[0]).toBeGreaterThan(0);

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
      const parsed = parseM3U8(m3u8);

      expect(parsed.segments.length).toBeGreaterThan(0);
      expect(parsed.durations[0]).toBeGreaterThan(0);

      const firstSegment = parsed.segments[0]!;
      const buffer = await streamer.getFileBuffer(firstSegment.start, firstSegment.end);
      expect(buffer.length).toBe(firstSegment.end - firstSegment.start);

      const duration = await streamer.getSegmentDuration(0);
      expect(duration).toBeCloseTo(parsed.durations[0]!, 3);

      await MockMP3.cleanup(largeMP3Path);
    });

    it('should generate playlists from a real MP3 fixture without mocks', async () => {
      const realFixturePath = path.resolve(__dirname, '..', 'example', 'sample.mp3');

      const streamer = new HlsStreamer({
        filePath: realFixturePath,
        segmentSizeKB: 512,
        fileName: 'sample',
        baseUrl: 'cdn'
      });

      const m3u8 = await streamer.createM3U8();
      const parsed = parseM3U8(m3u8);

      expect(parsed.segments.length).toBeGreaterThan(0);
      expect(parsed.durations.length).toBeGreaterThan(0);

      const fileInfo = await FileLib.analyzeMP3File(realFixturePath);
      const lastFrame = fileInfo.frames[fileInfo.frames.length - 1];
      if (lastFrame) {
        const lastSegment = parsed.segments[parsed.segments.length - 1];
        expect(lastSegment?.end).toBe(lastFrame.offset + lastFrame.length);
      }

      const targetDuration = parsed.targetDuration ?? 0;
      const maxDuration = Math.max(...parsed.durations);
      expect(targetDuration).toBe(Math.ceil(maxDuration));

      const duration = await streamer.getSegmentDuration(0);
      expect(duration).toBeCloseTo(parsed.durations[0]!, 3);
    });
  });
});
