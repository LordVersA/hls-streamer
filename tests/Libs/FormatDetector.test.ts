import { FormatDetector } from '../../src/Libs/FormatDetector';

describe('FormatDetector', () => {
  describe('detectFormat', () => {
    it('should detect MP3 format from ID3v2 tag', () => {
      const buffer = Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00');
      expect(FormatDetector.detectFormat(buffer)).toBe('mp3');
    });

    it('should detect MP3 format from frame sync', () => {
      const buffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
      expect(FormatDetector.detectFormat(buffer)).toBe('mp3');
    });

    it('should detect MP3 format from various frame sync patterns', () => {
      const buffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]); // 0xffe0 mask
      expect(FormatDetector.detectFormat(buffer)).toBe('mp3');
    });

    it('should detect FLAC format', () => {
      const buffer = Buffer.from('fLaC');
      expect(FormatDetector.detectFormat(buffer)).toBe('flac');
    });

    it('should detect OGG format', () => {
      const buffer = Buffer.from('OggS');
      expect(FormatDetector.detectFormat(buffer)).toBe('ogg');
    });

    it('should detect WAV format', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('RIFF', 0);
      buffer.write('WAVE', 8);
      expect(FormatDetector.detectFormat(buffer)).toBe('wav');
    });

    it('should detect M4A format with M4A brand', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('ftyp', 4);
      buffer.write('M4A ', 8);
      expect(FormatDetector.detectFormat(buffer)).toBe('m4a');
    });

    it('should detect M4A format with M4B brand', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('ftyp', 4);
      buffer.write('M4B ', 8);
      expect(FormatDetector.detectFormat(buffer)).toBe('m4a');
    });

    it('should detect MP4 format with mp42 brand', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('ftyp', 4);
      buffer.write('mp42', 8);
      expect(FormatDetector.detectFormat(buffer)).toBe('mp4');
    });

    it('should detect MP4 format with isom brand', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('ftyp', 4);
      buffer.write('isom', 8);
      expect(FormatDetector.detectFormat(buffer)).toBe('mp4');
    });

    it('should detect MOV format with qt brand', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('ftyp', 4);
      buffer.write('qt  ', 8);
      expect(FormatDetector.detectFormat(buffer)).toBe('mov');
    });

    it('should detect M4V format with M4V brand', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('ftyp', 4);
      buffer.write('M4V ', 8);
      expect(FormatDetector.detectFormat(buffer)).toBe('m4v');
    });

    it('should detect AAC ADTS format', () => {
      const buffer = Buffer.from([0xff, 0xf1, 0x00, 0x00]);
      expect(FormatDetector.detectFormat(buffer)).toBe('aac');
    });

    it('should return null for buffer too small', () => {
      const buffer = Buffer.from([0xff]);
      expect(FormatDetector.detectFormat(buffer)).toBeNull();
    });

    it('should return null for unknown format', () => {
      const buffer = Buffer.from('UNKNOWN_FORMAT');
      expect(FormatDetector.detectFormat(buffer)).toBeNull();
    });

    it('should return null for empty buffer', () => {
      const buffer = Buffer.alloc(0);
      expect(FormatDetector.detectFormat(buffer)).toBeNull();
    });
  });

  describe('detectFormatFromExtension', () => {
    it('should detect mp3 extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.mp3')).toBe('mp3');
      expect(FormatDetector.detectFormatFromExtension('path/to/audio.mp3')).toBe('mp3');
      expect(FormatDetector.detectFormatFromExtension('AUDIO.MP3')).toBe('mp3'); // Case insensitive
    });

    it('should detect aac extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.aac')).toBe('aac');
    });

    it('should detect m4a extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.m4a')).toBe('m4a');
    });

    it('should detect m4b extension as m4a', () => {
      expect(FormatDetector.detectFormatFromExtension('audiobook.m4b')).toBe('m4a');
    });

    it('should detect ogg extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.ogg')).toBe('ogg');
    });

    it('should detect oga extension as ogg', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.oga')).toBe('ogg');
    });

    it('should detect flac extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.flac')).toBe('flac');
    });

    it('should detect wav extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.wav')).toBe('wav');
    });

    it('should return null for unknown extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio.xyz')).toBeNull();
    });

    it('should return null for no extension', () => {
      expect(FormatDetector.detectFormatFromExtension('audio')).toBeNull();
    });

    it('should handle multiple dots in filename', () => {
      expect(FormatDetector.detectFormatFromExtension('my.audio.file.mp3')).toBe('mp3');
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = FormatDetector.getSupportedExtensions();
      expect(extensions).toEqual(['.mp3', '.aac', '.m4a', '.m4b', '.ogg', '.oga', '.flac', '.wav', '.mp4', '.mov', '.m4v']);
    });

    it('should return array with dot prefixes', () => {
      const extensions = FormatDetector.getSupportedExtensions();
      extensions.forEach(ext => {
        expect(ext.startsWith('.')).toBe(true);
      });
    });
  });

  describe('isSupportedExtension', () => {
    it('should return true for supported extensions', () => {
      expect(FormatDetector.isSupportedExtension('audio.mp3')).toBe(true);
      expect(FormatDetector.isSupportedExtension('audio.aac')).toBe(true);
      expect(FormatDetector.isSupportedExtension('audio.m4a')).toBe(true);
      expect(FormatDetector.isSupportedExtension('audio.m4b')).toBe(true);
      expect(FormatDetector.isSupportedExtension('audio.ogg')).toBe(true);
      expect(FormatDetector.isSupportedExtension('audio.oga')).toBe(true);
      expect(FormatDetector.isSupportedExtension('audio.flac')).toBe(true);
      expect(FormatDetector.isSupportedExtension('audio.wav')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(FormatDetector.isSupportedExtension('AUDIO.MP3')).toBe(true);
      expect(FormatDetector.isSupportedExtension('Audio.WaV')).toBe(true);
    });

    it('should return false for unsupported extensions', () => {
      expect(FormatDetector.isSupportedExtension('audio.xyz')).toBe(false);
      expect(FormatDetector.isSupportedExtension('audio.txt')).toBe(false);
      expect(FormatDetector.isSupportedExtension('audio')).toBe(false);
    });

    it('should handle paths', () => {
      expect(FormatDetector.isSupportedExtension('path/to/audio.mp3')).toBe(true);
    });
  });
});
