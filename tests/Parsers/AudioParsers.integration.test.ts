import { WavParser } from '../../src/Parsers/WavParser';
import { FlacParser } from '../../src/Parsers/FlacParser';
import { AacParser } from '../../src/Parsers/AacParser';
import { OggParser } from '../../src/Parsers/OggParser';
import { MockAudio } from '../fixtures/mock-audio';
import fs from 'fs';
import path from 'path';

describe('Audio Parsers Integration Tests', () => {
  const testDir = path.join(__dirname, '../temp-parsers-integration');
  const wavFile = path.join(testDir, 'test.wav');
  const flacFile = path.join(testDir, 'test.flac');
  const aacFile = path.join(testDir, 'test.aac');
  const m4aFile = path.join(testDir, 'test.m4a');
  const oggFile = path.join(testDir, 'test.ogg');

  beforeAll(async () => {
    // Create test directory
    await fs.promises.mkdir(testDir, { recursive: true });

    // Generate mock audio files (synchronous calls, but ensure directory exists first)
    try {
      MockAudio.createWav(wavFile, 2);
      MockAudio.createFlac(flacFile);
      MockAudio.createAac(aacFile);
      MockAudio.createM4a(m4aFile);
      MockAudio.createOgg(oggFile);
    } catch (error) {
      console.error('Failed to create mock audio files:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup
    await MockAudio.cleanup(wavFile, flacFile, aacFile, m4aFile, oggFile);
    try {
      await fs.promises.rmdir(testDir);
    } catch (e) {
      // Ignore
    }
  });

  describe('WavParser', () => {
    let parser: WavParser;

    beforeEach(() => {
      parser = new WavParser();
    });

    it('should return wav format', () => {
      expect(parser.getFormat()).toBe('wav');
    });

    it('should parse valid WAV file', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      const result = parser.analyze(buffer);

      expect(result.format).toBe('wav');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
      expect(result.bitDepth).toBe(16);
      expect(result.frames.length).toBeGreaterThan(0);
    });

    it('should validate WAV format', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should reject non-WAV format', () => {
      const buffer = Buffer.from('NOT A WAV FILE');
      expect(parser.canParse(buffer)).toBe(false);
    });

    it('should create frame table with correct structure', async () => {
      const buffer = await fs.promises.readFile(wavFile);
      const result = parser.analyze(buffer);

      expect(result.frames.length).toBeGreaterThan(0);
      const frame = result.frames[0];

      expect(frame.index).toBe(0);
      expect(frame.offset).toBeGreaterThan(0);
      expect(frame.length).toBeGreaterThan(0);
      expect(frame.duration).toBeGreaterThan(0);
      expect(frame.samples).toBeGreaterThan(0);
      expect(frame.sampleRate).toBe(44100);
      expect(frame.bitrate).toBeGreaterThan(0);
    });
  });

  describe('FlacParser', () => {
    let parser: FlacParser;

    beforeEach(() => {
      parser = new FlacParser();
    });

    it('should return flac format', () => {
      expect(parser.getFormat()).toBe('flac');
    });

    it('should parse valid FLAC file', async () => {
      const buffer = await fs.promises.readFile(flacFile);
      const result = parser.analyze(buffer);

      expect(result.format).toBe('flac');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
      expect(result.bitDepth).toBe(16);
    });

    it('should validate FLAC format', async () => {
      const buffer = await fs.promises.readFile(flacFile);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should reject non-FLAC format', () => {
      const buffer = Buffer.from('NOT A FLAC FILE');
      expect(parser.canParse(buffer)).toBe(false);
    });

    it('should parse STREAMINFO metadata', async () => {
      const buffer = await fs.promises.readFile(flacFile);
      const result = parser.analyze(buffer);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.minBlockSize).toBeDefined();
      expect(result.metadata?.maxBlockSize).toBeDefined();
      expect(result.metadata?.totalSamples).toBeDefined();
    });
  });

  describe('AacParser', () => {
    let parser: AacParser;

    beforeEach(() => {
      parser = new AacParser();
    });

    it('should return aac format', () => {
      expect(parser.getFormat()).toBe('aac');
    });

    it('should parse valid ADTS AAC file', async () => {
      const buffer = await fs.promises.readFile(aacFile);
      const result = parser.analyze(buffer);

      expect(result.format).toBe('aac');
      expect(result.frames.length).toBeGreaterThan(0);
    });

    it('should parse valid M4A file', async () => {
      const buffer = await fs.promises.readFile(m4aFile);
      const result = parser.analyze(buffer);

      expect(result.format).toBe('m4a');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should validate AAC ADTS format', async () => {
      const buffer = await fs.promises.readFile(aacFile);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should validate M4A format', async () => {
      const buffer = await fs.promises.readFile(m4aFile);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should create frame table for ADTS', async () => {
      const buffer = await fs.promises.readFile(aacFile);
      const result = parser.analyze(buffer);

      expect(result.frames.length).toBeGreaterThan(0);
      const frame = result.frames[0];

      expect(frame.index).toBeDefined();
      expect(frame.offset).toBeGreaterThanOrEqual(0);
      expect(frame.length).toBeGreaterThan(0);
      expect(frame.duration).toBeGreaterThan(0);
      expect(frame.samples).toBe(1024); // AAC typical
      expect(frame.sampleRate).toBeGreaterThan(0);
    });
  });

  describe('OggParser', () => {
    let parser: OggParser;

    beforeEach(() => {
      parser = new OggParser();
    });

    it('should return ogg format', () => {
      expect(parser.getFormat()).toBe('ogg');
    });

    it('should parse valid OGG file', async () => {
      const buffer = await fs.promises.readFile(oggFile);
      const result = parser.analyze(buffer);

      expect(result.format).toBe('ogg');
      // OGG parser may have different requirements based on implementation
    });

    it('should validate OGG format', async () => {
      const buffer = await fs.promises.readFile(oggFile);
      expect(parser.canParse(buffer)).toBe(true);
    });

    it('should reject non-OGG format', () => {
      const buffer = Buffer.from('NOT AN OGG FILE');
      expect(parser.canParse(buffer)).toBe(false);
    });
  });

  describe('Parser consistency', () => {
    it('all parsers should implement IAudioParser interface', () => {
      const parsers = [
        new WavParser(),
        new FlacParser(),
        new AacParser(),
        new OggParser()
      ];

      parsers.forEach(parser => {
        expect(typeof parser.getFormat).toBe('function');
        expect(typeof parser.canParse).toBe('function');
        expect(typeof parser.analyze).toBe('function');
      });
    });

    it('all parsers should return consistent AudioFileInfo structure', async () => {
      const files = [
        { file: wavFile, parser: new WavParser() },
        { file: flacFile, parser: new FlacParser() },
        { file: aacFile, parser: new AacParser() },
        { file: m4aFile, parser: new AacParser() }
      ];

      for (const { file, parser } of files) {
        const buffer = await fs.promises.readFile(file);
        const result = parser.analyze(buffer);

        // All should have these fields
        expect(result.format).toBeDefined();
        expect(typeof result.size).toBe('number');
        expect(typeof result.duration).toBe('number');
        expect(typeof result.audioDataSize).toBe('number');
        expect(Array.isArray(result.frames)).toBe(true);
      }
    });

    it('all frames should have consistent structure', async () => {
      const files = [
        { file: wavFile, parser: new WavParser() },
        { file: aacFile, parser: new AacParser() }
      ];

      for (const { file, parser } of files) {
        const buffer = await fs.promises.readFile(file);
        const result = parser.analyze(buffer);

        if (result.frames.length > 0) {
          const frame = result.frames[0];
          expect(typeof frame.index).toBe('number');
          expect(typeof frame.offset).toBe('number');
          expect(typeof frame.length).toBe('number');
          expect(typeof frame.duration).toBe('number');
          expect(typeof frame.samples).toBe('number');
          expect(typeof frame.sampleRate).toBe('number');
          expect(typeof frame.bitrate).toBe('number');
        }
      }
    });
  });
});
