import { FileLib } from '../../src/Libs/FileLib';
import { MockMP3 } from '../fixtures/mock-mp3';
import { MockAudio } from '../fixtures/mock-audio';
import fs from 'fs';
import path from 'path';

describe('FileLib', () => {
  describe('getFileSizeInBytes', () => {
    it('should return correct size for buffer', () => {
      const buffer = Buffer.from('test data');
      const size = FileLib.getFileSizeInBytes(buffer);
      expect(size).toBe(buffer.length);
      expect(size).toBe(9); // 'test data' is 9 bytes
    });

    it('should return 0 for empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const size = FileLib.getFileSizeInBytes(buffer);
      expect(size).toBe(0);
    });

    it('should return correct size for large buffer', () => {
      const buffer = Buffer.alloc(1024 * 1024); // 1MB
      const size = FileLib.getFileSizeInBytes(buffer);
      expect(size).toBe(1024 * 1024);
    });

    it('should throw error for non-buffer input', () => {
      expect(() => {
        FileLib.getFileSizeInBytes('not a buffer' as any);
      }).toThrow('Input is not a buffer');
    });

    it('should throw error for null input', () => {
      expect(() => {
        FileLib.getFileSizeInBytes(null as any);
      }).toThrow('Input is not a buffer');
    });

    it('should throw error for undefined input', () => {
      expect(() => {
        FileLib.getFileSizeInBytes(undefined as any);
      }).toThrow('Input is not a buffer');
    });

    it('should throw error for object input', () => {
      expect(() => {
        FileLib.getFileSizeInBytes({} as any);
      }).toThrow('Input is not a buffer');
    });
  });

  describe('getMP3DurationFromBuffer', () => {
    it('should return duration for valid MP3 buffer', async () => {
      const buffer = MockMP3.createMockMP3Buffer(1024);
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10); // Should be reasonable duration
    });

    it('should return duration for small MP3 buffer', async () => {
      const buffer = MockMP3.createMockMP3Buffer(100);
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });

    it('should return duration for large MP3 buffer', async () => {
      const buffer = MockMP3.createMockMP3Buffer(10240); // 10KB
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });

    it('should handle empty buffer gracefully', async () => {
      const buffer = Buffer.alloc(0);
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBe(0);
    });

    it('should handle buffer with minimum size', async () => {
      const buffer = MockMP3.createMockMP3Buffer(4); // Just the header
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMP3DurationFromBuffer error handling', () => {
    it('should handle invalid MP3 data gracefully', async () => {
      const buffer = Buffer.from('invalid mp3 data');
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0); // Should fallback to estimation
    });

    it('should parse valid mock MP3 buffer', async () => {
      const buffer = MockMP3.createMockMP3Buffer(1024);
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('analyzeAudioFile', () => {
    const testDir = path.join(__dirname, '../temp-filelib-audio');
    const wavFile = path.join(testDir, 'test-filelib.wav');
    const flacFile = path.join(testDir, 'test-filelib.flac');
    const aacFile = path.join(testDir, 'test-filelib.aac');
    const m4aFile = path.join(testDir, 'test-filelib.m4a');

    beforeAll(async () => {
      await fs.promises.mkdir(testDir, { recursive: true });
      MockAudio.createWav(wavFile, 2);
      MockAudio.createFlac(flacFile);
      MockAudio.createAac(aacFile);
      MockAudio.createM4a(m4aFile);
    });

    afterAll(async () => {
      await MockAudio.cleanup(wavFile, flacFile, aacFile, m4aFile);
      try {
        await fs.promises.rmdir(testDir);
      } catch (e) {
        // Ignore
      }
    });

    it('should analyze WAV file with auto-detection', async () => {
      const result = await FileLib.analyzeAudioFile(wavFile);

      expect(result.format).toBe('wav');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
      expect(result.frames.length).toBeGreaterThan(0);
    });

    it('should analyze FLAC file with auto-detection', async () => {
      const result = await FileLib.analyzeAudioFile(flacFile);

      expect(result.format).toBe('flac');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
    });

    it('should analyze AAC file with auto-detection', async () => {
      const result = await FileLib.analyzeAudioFile(aacFile);

      expect(result.format).toBe('aac');
      expect(result.frames.length).toBeGreaterThan(0);
    });

    it('should analyze M4A file with auto-detection', async () => {
      const result = await FileLib.analyzeAudioFile(m4aFile);

      expect(result.format).toBe('m4a');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should analyze file with format override', async () => {
      const result = await FileLib.analyzeAudioFile(wavFile, 'wav');

      expect(result.format).toBe('wav');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should include fileSize in metadata', async () => {
      const result = await FileLib.analyzeAudioFile(wavFile);
      const stat = await fs.promises.stat(wavFile);

      expect(result.size).toBe(stat.size);
    });

    it('should throw error for unsupported format override', async () => {
      try {
        await FileLib.analyzeAudioFile(wavFile, 'unknown' as any);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Unsupported format');
      }
    });

    it('should throw error for unknown file format', async () => {
      const unknownFile = path.join(testDir, 'unknown.xyz');

      try {
        await fs.promises.writeFile(unknownFile, 'unknown content');

        try {
          await FileLib.analyzeAudioFile(unknownFile);
          fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).toContain('Could not detect audio format');
        }
      } finally {
        try {
          await fs.promises.unlink(unknownFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('analyzeAudioBuffer', () => {
    const testDir = path.join(__dirname, '../temp-filelib-buffer');
    const wavFile = path.join(testDir, 'test-buffer.wav');

    beforeAll(async () => {
      await fs.promises.mkdir(testDir, { recursive: true });
      MockAudio.createWav(wavFile, 1);
    });

    afterAll(async () => {
      await MockAudio.cleanup(wavFile);
      try {
        await fs.promises.rmdir(testDir);
      } catch (e) {
        // Ignore
      }
    });

    it('should analyze WAV buffer with auto-detection from content', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      const result = FileLib.analyzeAudioBuffer(buffer);

      expect(result.format).toBe('wav');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should analyze buffer with format override', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      const result = FileLib.analyzeAudioBuffer(buffer, { format: 'wav' });

      expect(result.format).toBe('wav');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should analyze buffer with filePath hint for format detection', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      const result = FileLib.analyzeAudioBuffer(buffer, { filePath: 'test.wav' });

      expect(result.format).toBe('wav');
    });

    it('should use fileSize option when provided', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      const fileSize = 10000;
      const result = FileLib.analyzeAudioBuffer(buffer, { fileSize });

      expect(result.size).toBe(fileSize);
    });

    it('should default to buffer length when fileSize not provided', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      const result = FileLib.analyzeAudioBuffer(buffer);

      expect(result.size).toBe(buffer.length);
    });

    it('should throw error for unsupported format override', async () => {
      const buffer = await fs.promises.readFile(wavFile);

      expect(() =>
        FileLib.analyzeAudioBuffer(buffer, { format: 'unknown' as any })
      ).toThrow('Unsupported format');
    });

    it('should throw error when format cannot be detected', () => {
      const buffer = Buffer.from('UNKNOWN_CONTENT');

      expect(() =>
        FileLib.analyzeAudioBuffer(buffer)
      ).toThrow('Could not detect audio format');
    });

    it('should prioritize format override over other detection methods', async () => {
      const buffer = await fs.promises.readFile(wavFile);

      const result = FileLib.analyzeAudioBuffer(buffer, {
        format: 'wav',
        filePath: 'test.mp3' // Should ignore this
      });

      expect(result.format).toBe('wav');
    });
  });
});