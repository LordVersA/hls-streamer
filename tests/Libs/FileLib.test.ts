import { FileLib } from '../../src/Libs/FileLib';
import { MockMP3 } from '../fixtures/mock-mp3';

// Mock the mp3-duration module
jest.mock('mp3-duration', () => {
  return jest.fn((buffer: Buffer, callback: (err: Error | null, duration: number) => void) => {
    // Simulate realistic duration based on buffer size
    // Assume ~128kbps MP3: 16000 bytes per second
    const estimatedDuration = buffer.length / 16000;

    // Add some randomness but keep it deterministic for testing
    const duration = Math.max(0.1, estimatedDuration);

    // Simulate async behavior
    setTimeout(() => {
      callback(null, duration);
    }, 10);
  });
});

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
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle buffer with minimum size', async () => {
      const buffer = MockMP3.createMockMP3Buffer(4); // Just the header
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMP3DurationFromBuffer error handling', () => {
    beforeEach(() => {
      // Reset the mock to simulate errors
      jest.clearAllMocks();
    });

    it('should reject promise when mp3-duration returns error', async () => {
      // Mock mp3-duration to return an error
      const mp3Duration = require('mp3-duration');
      mp3Duration.mockImplementation((_buffer: Buffer, callback: (err: Error | null, duration: number) => void) => {
        setTimeout(() => {
          callback(new Error('Invalid MP3 format'), 0);
        }, 10);
      });

      const buffer = Buffer.from('invalid mp3 data');

      await expect(FileLib.getMP3DurationFromBuffer(buffer)).rejects.toThrow('Invalid MP3 format');
    });

    it('should handle null error correctly', async () => {
      // Mock mp3-duration to return success with null error
      const mp3Duration = require('mp3-duration');
      mp3Duration.mockImplementation((_buffer: Buffer, callback: (err: Error | null, duration: number) => void) => {
        setTimeout(() => {
          callback(null, 3.5);
        }, 10);
      });

      const buffer = MockMP3.createMockMP3Buffer(1024);
      const duration = await FileLib.getMP3DurationFromBuffer(buffer);

      expect(duration).toBe(3.5);
    });
  });
});