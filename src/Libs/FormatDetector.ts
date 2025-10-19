import { AudioFormat } from '../Parsers/IAudioParser';

/**
 * Detects audio format from file buffer using magic bytes
 */
export class FormatDetector {
  /**
   * Detect audio format from buffer
   * @param buffer File buffer (at least first 16 bytes recommended)
   * @returns Detected format or null if unknown
   */
  static detectFormat(buffer: Buffer): AudioFormat | null {
    if (buffer.length < 4) {
      return null;
    }

    // MP3: ID3v2 tag or frame sync
    if (buffer.toString('ascii', 0, 3) === 'ID3') {
      return 'mp3';
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) {
      return 'mp3';
    }

    // FLAC: 'fLaC' signature
    if (buffer.toString('ascii', 0, 4) === 'fLaC') {
      return 'flac';
    }

    // OGG: 'OggS' signature
    if (buffer.toString('ascii', 0, 4) === 'OggS') {
      return 'ogg';
    }

    // WAV: RIFF header with WAVE format
    if (buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE') {
      return 'wav';
    }

    // M4A/AAC: ftyp box (ISO Base Media File Format)
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      // Check for M4A-specific brands
      const brand = buffer.toString('ascii', 8, 12);
      if (brand === 'M4A ' || brand === 'M4B ' || brand === 'mp42' || brand === 'isom') {
        return 'm4a';
      }
    }

    // AAC: ADTS header (0xFFF sync word)
    if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1]! & 0xf6) === 0xf0) {
      return 'aac';
    }

    return null;
  }

  /**
   * Detect format from file extension
   * @param filePath File path or extension
   * @returns Detected format or null if unknown
   */
  static detectFormatFromExtension(filePath: string): AudioFormat | null {
    const ext = filePath.toLowerCase().split('.').pop();

    switch (ext) {
      case 'mp3':
        return 'mp3';
      case 'aac':
        return 'aac';
      case 'm4a':
      case 'm4b':
        return 'm4a';
      case 'ogg':
      case 'oga':
        return 'ogg';
      case 'flac':
        return 'flac';
      case 'wav':
        return 'wav';
      default:
        return null;
    }
  }

  /**
   * Get supported file extensions
   */
  static getSupportedExtensions(): string[] {
    return ['.mp3', '.aac', '.m4a', '.m4b', '.ogg', '.oga', '.flac', '.wav'];
  }

  /**
   * Check if file extension is supported
   */
  static isSupportedExtension(filePath: string): boolean {
    const ext = '.' + filePath.toLowerCase().split('.').pop();
    return this.getSupportedExtensions().includes(ext);
  }
}
