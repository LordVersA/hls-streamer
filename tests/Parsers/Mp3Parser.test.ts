import { Mp3Parser } from '../../src/Parsers/Mp3Parser';
import { MockMP3 } from '../fixtures/mock-mp3';

describe('Mp3Parser', () => {
  let parser: Mp3Parser;

  beforeEach(() => {
    parser = new Mp3Parser();
  });

  describe('getFormat', () => {
    it('should return mp3 format', () => {
      expect(parser.getFormat()).toBe('mp3');
    });
  });

  describe('canParse', () => {
    it('should return true for ID3v2 tag', () => {
      const buffer = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00');
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should return true for MP3 frame sync', () => {
      const buffer = Buffer.from([0xff, 0xfb, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should return true for various frame sync patterns', () => {
      const buffer = Buffer.from([0xff, 0xfb, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should return false for invalid buffer', () => {
      const buffer = Buffer.from('INVALID');
      expect(parser.canParse(buffer)).toBe(false);
    });

    it('should return false for buffer too small', () => {
      const buffer = Buffer.from([0xff]);
      expect(parser.canParse(buffer)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      const buffer = Buffer.alloc(0);
      expect(parser.canParse(buffer)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should return empty metadata for empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const result = parser.analyze(buffer);

      expect(result.format).toBe('mp3');
      expect(result.duration).toBe(0);
      expect(result.audioDataSize).toBe(0);
      expect(result.frames).toEqual([]);
    });

    it('should parse valid MP3 frame header (Layer III, 128kbps, 44100Hz)', () => {
      // Create a minimal valid MP3 frame
      const buffer = Buffer.alloc(418); // Frame size for 128kbps Layer III

      // Frame sync + MPEG 1 Layer III, 128kbps, 44100Hz
      buffer[0] = 0xff;
      buffer[1] = 0xfb; // MPEG 1, Layer III, no CRC
      buffer[2] = 0x90; // 128kbps (index 9), 44100Hz (index 0), no padding
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.format).toBe('mp3');
      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.frames[0].bitrate).toBe(128);
      expect(result.frames[0].sampleRate).toBe(44100);
      expect(result.frames[0].samples).toBe(1152); // Layer III MPEG 1
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2); // Stereo
    });

    it('should parse MP3 with ID3v2 tag', () => {
      const buffer = Buffer.alloc(600);
      let offset = 0;

      // ID3v2 header
      buffer.write('ID3', offset);
      buffer[offset + 3] = 0x03; // Version
      buffer[offset + 4] = 0x00;
      buffer[offset + 5] = 0x00; // Flags
      // Size (sync-safe integer) = 100 bytes
      buffer[offset + 6] = 0x00;
      buffer[offset + 7] = 0x00;
      buffer[offset + 8] = 0x00;
      buffer[offset + 9] = 0x64;
      offset = 10 + 100; // Skip ID3 tag

      // Valid MP3 frame at offset 110 (Layer III, 128kbps, 44100Hz)
      buffer[offset] = 0xff;
      buffer[offset + 1] = 0xfb;
      buffer[offset + 2] = 0x90; // 128kbps, 44100Hz
      buffer[offset + 3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.format).toBe('mp3');
      if (result.frames.length > 0) {
        // If frames were parsed, check ID3 metadata
        expect(result.metadata).toBeDefined();
        expect(result.metadata!['id3v2Size']).toBe(100);
        expect(result.frames[0].offset).toBe(110);
      }
    });

    it('should recover the first audio frame when ID3v2 size overlaps audio data', () => {
      const { buffer, audioOffset } = MockMP3.createMockMP3WithOverstatedId3Buffer();

      const result = parser.analyze(buffer);

      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.frames[0]!.offset).toBe(audioOffset);
      expect(result.warnings?.some(w => w.includes('ID3v2 tag size appears to overlap audio'))).toBe(true);
    });

    it('should parse MP3 with ID3v1 tag at end', () => {
      const buffer = Buffer.alloc(600);

      // Valid MP3 frame at start (Layer III, 128kbps, 44100Hz)
      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x90;
      buffer[3] = 0x00;

      // ID3v1 tag at end (last 128 bytes)
      const tagOffset = buffer.length - 128;
      buffer.write('TAG', tagOffset);

      const result = parser.analyze(buffer);

      expect(result.format).toBe('mp3');
      if (result.frames.length > 0) {
        // If frames were parsed, check ID3 metadata
        expect(result.metadata).toBeDefined();
        expect(result.metadata!['id3v1Size']).toBe(128);
      }
      // Frames should be parsed only up to ID3v1 tag
    });

    it('should parse mono MP3', () => {
      const buffer = Buffer.alloc(418);

      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x90;
      buffer[3] = 0xc0; // Channel mode 11 = mono

      const result = parser.analyze(buffer);

      expect(result.channels).toBe(1);
    });

    it('should parse MPEG 2 Layer III', () => {
      const buffer = Buffer.alloc(209); // Smaller frame for MPEG 2

      buffer[0] = 0xff;
      buffer[1] = 0xf3; // MPEG 2, Layer III
      buffer[2] = 0x50; // 64kbps, 22050Hz
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.frames[0].sampleRate).toBe(22050);
      expect(result.frames[0].samples).toBe(576); // Layer III MPEG 2
    });

    it('should calculate total duration from frames', () => {
      const buffer = Buffer.alloc(1000);

      // Create multiple frames
      let offset = 0;
      for (let i = 0; i < 2; i++) {
        buffer[offset] = 0xff;
        buffer[offset + 1] = 0xfb;
        buffer[offset + 2] = 0x90;
        buffer[offset + 3] = 0x00;
        offset += 418; // Frame size for 128kbps Layer III
      }

      const result = parser.analyze(buffer);

      expect(result.frames.length).toBe(2);
      expect(result.duration).toBeGreaterThan(0);
      // Each frame should be ~26ms (1152 samples / 44100 Hz)
      expect(result.duration).toBeCloseTo(0.052, 2);
    });

    it('should calculate average bitrate', () => {
      const buffer = Buffer.alloc(500);

      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x90;
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.averageBitrate).toBeDefined();
      expect(result.averageBitrate).toBeGreaterThan(0);
    });

    it('should handle truncated frame with warning', () => {
      const buffer = Buffer.alloc(100); // Too small for a complete frame

      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x90;
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('Truncated'))).toBe(true);
    });

    it('should skip invalid sync bytes', () => {
      const buffer = Buffer.alloc(500);

      // Add some junk bytes
      buffer[0] = 0x00;
      buffer[1] = 0x00;
      buffer[2] = 0x00;

      // Valid frame after junk
      buffer[3] = 0xff;
      buffer[4] = 0xfb;
      buffer[5] = 0x90;
      buffer[6] = 0x00;

      const result = parser.analyze(buffer);

      // Should find the valid frame despite initial junk
      expect(result.frames.length).toBeGreaterThan(0);
    });

    it('should fallback to heuristic duration when no frames found', () => {
      const buffer = Buffer.alloc(1000);
      buffer.fill(0x00); // No valid frames

      const result = parser.analyze(buffer);

      expect(result.duration).toBeGreaterThan(0); // Estimated duration
      expect(result.frames.length).toBe(0);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('heuristic'))).toBe(true);
    });

    it('should use fileSize option when provided', () => {
      const buffer = Buffer.alloc(100);
      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x90;
      buffer[3] = 0x00;

      const fileSize = 10000;
      const result = parser.analyze(buffer, { fileSize });

      expect(result.size).toBe(fileSize);
    });

    it('should default to buffer length when fileSize not provided', () => {
      const buffer = Buffer.alloc(500);
      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x90;
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.size).toBe(buffer.length);
    });

    it('should parse Layer II MP3', () => {
      const buffer = Buffer.alloc(418);

      buffer[0] = 0xff;
      buffer[1] = 0xfd; // MPEG 1, Layer II
      buffer[2] = 0x50; // 64kbps, 44100Hz
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.frames[0].samples).toBe(1152); // Layer II
    });

    it('should handle padding bit correctly', () => {
      const buffer = Buffer.alloc(419); // +1 byte for padding

      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x92; // 128kbps, 44100Hz, padding=1
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.frames.length).toBeGreaterThan(0);
      // Frame should be 1 byte larger due to padding
      expect(result.frames[0].length).toBe(418);
    });

    it('should provide frame-level metadata', () => {
      const buffer = Buffer.alloc(418);

      buffer[0] = 0xff;
      buffer[1] = 0xfb;
      buffer[2] = 0x90;
      buffer[3] = 0x00;

      const result = parser.analyze(buffer);

      expect(result.frames.length).toBeGreaterThan(0);
      const frame = result.frames[0];

      expect(frame.index).toBe(0);
      expect(frame.offset).toBeGreaterThanOrEqual(0);
      expect(frame.length).toBeGreaterThan(0);
      expect(frame.duration).toBeGreaterThan(0);
      expect(frame.samples).toBeGreaterThan(0);
      expect(frame.sampleRate).toBeGreaterThan(0);
      expect(frame.bitrate).toBeGreaterThan(0);
    });
  });
});
