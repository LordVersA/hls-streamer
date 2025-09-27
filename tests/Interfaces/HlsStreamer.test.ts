import { HlsStreamerOptions, SegmentInfo, Mp3FileInfo } from '../../src/Interfaces/HlsStreamer';

describe('HlsStreamer Interfaces', () => {
  describe('HlsStreamerOptions', () => {
    it('should define interface with required filePath', () => {
      const options: HlsStreamerOptions = {
        filePath: '/path/to/file.mp3'
      };

      expect(options.filePath).toBe('/path/to/file.mp3');
    });

    it('should allow all optional properties', () => {
      const options: HlsStreamerOptions = {
        filePath: '/path/to/file.mp3',
        segmentSizeKB: 512,
        fileName: 'audio',
        baseUrl: 'api/v1',
        enableFastStart: true
      };

      expect(options.filePath).toBe('/path/to/file.mp3');
      expect(options.segmentSizeKB).toBe(512);
      expect(options.fileName).toBe('audio');
      expect(options.baseUrl).toBe('api/v1');
      expect(options.enableFastStart).toBe(true);
    });

    it('should work with partial optional properties', () => {
      const options: HlsStreamerOptions = {
        filePath: '/path/to/file.mp3',
        segmentSizeKB: 256
      };

      expect(options.filePath).toBe('/path/to/file.mp3');
      expect(options.segmentSizeKB).toBe(256);
      expect(options.fileName).toBeUndefined();
      expect(options.baseUrl).toBeUndefined();
      expect(options.enableFastStart).toBeUndefined();
    });
  });

  describe('SegmentInfo', () => {
    it('should define interface with all required properties', () => {
      const segment: SegmentInfo = {
        start: 0,
        end: 1024,
        duration: 10.5
      };

      expect(segment.start).toBe(0);
      expect(segment.end).toBe(1024);
      expect(segment.duration).toBe(10.5);
    });

    it('should allow negative start/end values', () => {
      const segment: SegmentInfo = {
        start: -1,
        end: -1,
        duration: 0
      };

      expect(segment.start).toBe(-1);
      expect(segment.end).toBe(-1);
      expect(segment.duration).toBe(0);
    });

    it('should allow fractional values', () => {
      const segment: SegmentInfo = {
        start: 0.5,
        end: 1024.7,
        duration: 10.123456
      };

      expect(segment.start).toBe(0.5);
      expect(segment.end).toBe(1024.7);
      expect(segment.duration).toBe(10.123456);
    });
  });

  describe('Mp3FileInfo', () => {
    it('should define interface with all required properties', () => {
      const fileInfo: Mp3FileInfo = {
        size: 1048576,
        duration: 180.5
      };

      expect(fileInfo.size).toBe(1048576);
      expect(fileInfo.duration).toBe(180.5);
    });

    it('should allow zero values', () => {
      const fileInfo: Mp3FileInfo = {
        size: 0,
        duration: 0
      };

      expect(fileInfo.size).toBe(0);
      expect(fileInfo.duration).toBe(0);
    });

    it('should allow large values', () => {
      const fileInfo: Mp3FileInfo = {
        size: Number.MAX_SAFE_INTEGER,
        duration: 99999.999
      };

      expect(fileInfo.size).toBe(Number.MAX_SAFE_INTEGER);
      expect(fileInfo.duration).toBe(99999.999);
    });
  });
});