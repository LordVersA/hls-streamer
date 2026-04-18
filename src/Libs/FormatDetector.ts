import { MediaFormat } from '../Parsers/IMediaParser';

/**
 * Detects audio format from file buffer using magic bytes
 */
export class FormatDetector {
  /**
   * Detect audio format from buffer
   * @param buffer File buffer (at least first 16 bytes recommended)
   * @returns Detected format or null if unknown
   */
  static detectFormat(buffer: Buffer): MediaFormat | null {
    if (buffer.length < 4) {
      return null;
    }

    // MP3: ID3v2 tag or frame sync
    if (buffer.toString('ascii', 0, 3) === 'ID3') {
      return 'mp3';
    }
    if (buffer.length >= 2 && buffer[0] === 0xff) {
      const secondByte = buffer[1]!;

      // AAC ADTS sync (12-bit 0xFFF with layer bits fixed to 00)
      if ((secondByte & 0xf6) === 0xf0) {
        return 'aac';
      }

      // MP3 sync with valid version/layer bits (avoid ADTS false positives)
      if ((secondByte & 0xe0) === 0xe0) {
        const versionBits = (secondByte >> 3) & 0x3;
        const layerBits = (secondByte >> 1) & 0x3;
        if (versionBits !== 0x1 && layerBits !== 0x0) {
          return 'mp3';
        }
      }
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

    // ftyp box (ISO Base Media File Format) — M4A audio or MP4/MOV/M4V video
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      const brand = buffer.toString('ascii', 8, 12);
      // M4A/M4B audio brands
      if (brand === 'M4A ' || brand === 'M4B ') {
        return 'm4a';
      }
      // MOV brand
      if (brand === 'qt  ') {
        return 'mov';
      }
      // M4V brand
      if (brand.startsWith('M4V')) {
        return 'm4v';
      }
      // Generic ISOBMFF — check compatible brands for audio vs video
      // brands like 'isom', 'mp41', 'mp42', 'avc1', 'iso2', etc. → mp4 video
      // 'mp42' can be both; default to mp4 for generic brands
      if (brand === 'mp42' || brand === 'isom' || brand === 'mp41' ||
          brand === 'avc1' || brand === 'iso2' || brand === 'iso5' || brand === 'iso6') {
        return 'mp4';
      }
      // Unknown ftyp brand — default to mp4
      return 'mp4';
    }

    return null;
  }

  /**
   * Detect format from file extension
   * @param filePath File path or extension
   * @returns Detected format or null if unknown
   */
  static detectFormatFromExtension(filePath: string): MediaFormat | null {
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
      case 'mp4':
        return 'mp4';
      case 'mov':
        return 'mov';
      case 'm4v':
        return 'm4v';
      default:
        return null;
    }
  }

  /**
   * Get supported file extensions
   */
  static getSupportedExtensions(): string[] {
    return ['.mp3', '.aac', '.m4a', '.m4b', '.ogg', '.oga', '.flac', '.wav', '.mp4', '.mov', '.m4v'];
  }

  /**
   * Check if file extension is supported
   */
  static isSupportedExtension(filePath: string): boolean {
    const ext = '.' + filePath.toLowerCase().split('.').pop();
    return this.getSupportedExtensions().includes(ext);
  }
}
