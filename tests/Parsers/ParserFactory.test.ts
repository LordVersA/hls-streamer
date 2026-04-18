import { ParserFactory } from '../../src/Parsers/ParserFactory';

describe('ParserFactory', () => {
  describe('getParser', () => {
    it('should return Mp3Parser for mp3 format', () => {
      const parser = ParserFactory.getParser('mp3');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('mp3');
    });

    it('should return AacParser for aac format', () => {
      const parser = ParserFactory.getParser('aac');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('aac');
    });

    it('should return AacParser for m4a format', () => {
      const parser = ParserFactory.getParser('m4a');
      expect(parser).toBeDefined();
      // M4A uses AacParser
      expect(parser?.getFormat()).toBe('aac');
    });

    it('should return OggParser for ogg format', () => {
      const parser = ParserFactory.getParser('ogg');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('ogg');
    });

    it('should return FlacParser for flac format', () => {
      const parser = ParserFactory.getParser('flac');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('flac');
    });

    it('should return WavParser for wav format', () => {
      const parser = ParserFactory.getParser('wav');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('wav');
    });

    it('should return null for unknown format', () => {
      const parser = ParserFactory.getParser('unknown' as any);
      expect(parser).toBeNull();
    });
  });

  describe('detectParser', () => {
    it('should detect MP3 parser from ID3v2 tag', () => {
      const buffer = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00');
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('mp3');
    });

    it('should detect MP3 parser from frame sync', () => {
      const buffer = Buffer.from([0xff, 0xfb, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('mp3');
    });

    it('should detect FLAC parser', () => {
      const buffer = Buffer.from('fLaC');
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('flac');
    });

    it('should detect OGG parser', () => {
      const buffer = Buffer.from('OggS');
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('ogg');
    });

    it('should detect WAV parser', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('RIFF', 0);
      buffer.write('WAVE', 8);
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('wav');
    });

    it('should detect AAC parser from ADTS header', () => {
      const buffer = Buffer.from([0xff, 0xf1, 0x00, 0x00]);
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('aac');
    });

    it('should detect AAC parser from full ADTS frame buffer', () => {
      const buffer = Buffer.alloc(16, 0);
      buffer[0] = 0xff;
      buffer[1] = 0xf1;
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('aac');
    });

    it('should return null for unknown format', () => {
      const buffer = Buffer.from('UNKNOWN_FORMAT');
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeNull();
    });

    it('should return null for empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const parser = ParserFactory.detectParser(buffer);
      expect(parser).toBeNull();
    });
  });

  describe('getParserByExtension', () => {
    it('should return Mp3Parser for .mp3 extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.mp3');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('mp3');
    });

    it('should return AacParser for .aac extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.aac');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('aac');
    });

    it('should return AacParser for .m4a extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.m4a');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('aac');
    });

    it('should return AacParser for .m4b extension', () => {
      const parser = ParserFactory.getParserByExtension('audiobook.m4b');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('aac');
    });

    it('should return OggParser for .ogg extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.ogg');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('ogg');
    });

    it('should return OggParser for .oga extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.oga');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('ogg');
    });

    it('should return FlacParser for .flac extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.flac');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('flac');
    });

    it('should return WavParser for .wav extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.wav');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('wav');
    });

    it('should be case insensitive', () => {
      const parser = ParserFactory.getParserByExtension('AUDIO.MP3');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('mp3');
    });

    it('should handle full paths', () => {
      const parser = ParserFactory.getParserByExtension('/path/to/audio.mp3');
      expect(parser).toBeDefined();
      expect(parser?.getFormat()).toBe('mp3');
    });

    it('should return null for unknown extension', () => {
      const parser = ParserFactory.getParserByExtension('audio.xyz');
      expect(parser).toBeNull();
    });

    it('should return null for no extension', () => {
      const parser = ParserFactory.getParserByExtension('audio');
      expect(parser).toBeNull();
    });
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      const formats = ParserFactory.getSupportedFormats();
      expect(formats).toEqual(['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav', 'mp4', 'mov', 'm4v']);
    });

    it('should return an array', () => {
      const formats = ParserFactory.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
    });
  });

  describe('isFormatSupported', () => {
    it('should return true for supported formats', () => {
      expect(ParserFactory.isFormatSupported('mp3')).toBe(true);
      expect(ParserFactory.isFormatSupported('aac')).toBe(true);
      expect(ParserFactory.isFormatSupported('m4a')).toBe(true);
      expect(ParserFactory.isFormatSupported('ogg')).toBe(true);
      expect(ParserFactory.isFormatSupported('flac')).toBe(true);
      expect(ParserFactory.isFormatSupported('wav')).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      expect(ParserFactory.isFormatSupported('xyz')).toBe(false);
      expect(ParserFactory.isFormatSupported('avi')).toBe(false);
    });

    it('should return true for video formats', () => {
      expect(ParserFactory.isFormatSupported('mp4')).toBe(true);
      expect(ParserFactory.isFormatSupported('mov')).toBe(true);
      expect(ParserFactory.isFormatSupported('m4v')).toBe(true);
    });

    it('should handle empty string', () => {
      expect(ParserFactory.isFormatSupported('')).toBe(false);
    });
  });

  describe('parser reusability', () => {
    it('should return same parser instance for same format', () => {
      const parser1 = ParserFactory.getParser('mp3');
      const parser2 = ParserFactory.getParser('mp3');
      expect(parser1).toBe(parser2); // Same instance
    });

    it('should return same parser from different methods', () => {
      const parserByFormat = ParserFactory.getParser('mp3');
      const parserByExtension = ParserFactory.getParserByExtension('audio.mp3');
      expect(parserByFormat).toBe(parserByExtension);
    });

    it('should return same parser from detectParser', () => {
      const buffer = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00');
      const detectedParser = ParserFactory.detectParser(buffer);
      const mp3Parser = ParserFactory.getParser('mp3');
      expect(detectedParser).toBe(mp3Parser);
    });
  });
});
