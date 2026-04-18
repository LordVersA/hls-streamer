import { IMediaParser, MediaFormat } from './IMediaParser';
import { Mp3Parser } from './Mp3Parser';
import { AacParser } from './AacParser';
import { OggParser } from './OggParser';
import { FlacParser } from './FlacParser';
import { WavParser } from './WavParser';
import { Mp4Parser } from './Mp4Parser';
import { FormatDetector } from '../Libs/FormatDetector';

/**
 * Factory for creating appropriate audio parser based on format
 */
export class ParserFactory {
  private static parsers: IMediaParser[] = [
    new Mp3Parser(),
    new AacParser(),
    new OggParser(),
    new FlacParser(),
    new WavParser(),
    new Mp4Parser(),
  ];

  /**
   * Get parser for specified format
   * @param format Audio format
   * @returns Parser instance or null if not found
   */
  static getParser(format: MediaFormat): IMediaParser | null {
    // AAC and M4A both use AacParser
    const searchFormat = format === 'm4a' ? 'aac' : format;
    // MOV and M4V share Mp4Parser
    const resolvedFormat = (searchFormat === 'mov' || searchFormat === 'm4v') ? 'mp4' : searchFormat;

    return this.parsers.find(parser => parser.getFormat() === resolvedFormat) || null;
  }

  /**
   * Auto-detect format and return appropriate parser
   * @param buffer File buffer (at least first 16 bytes)
   * @returns Parser instance or null if format not detected
   */
  static detectParser(buffer: Buffer): IMediaParser | null {
    // Try each parser's canParse method
    for (const parser of this.parsers) {
      if (parser.canParse(buffer)) {
        return parser;
      }
    }

    return null;
  }

  /**
   * Get parser by file extension
   * @param filePath File path
   * @returns Parser instance or null if not supported
   */
  static getParserByExtension(filePath: string): IMediaParser | null {
    const format = FormatDetector.detectFormatFromExtension(filePath);
    return format ? this.getParser(format) : null;
  }

  /**
   * Get all supported formats
   */
  static getSupportedFormats(): MediaFormat[] {
    return ['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav', 'mp4', 'mov', 'm4v'];
  }

  /**
   * Check if format is supported
   */
  static isFormatSupported(format: string): boolean {
    return this.getSupportedFormats().includes(format as MediaFormat);
  }
}
