import { AudioFormat } from '../Parsers/IAudioParser';

/**
 * Configuration options for HLS streamer
 */
export interface HlsStreamerOptions {
  /** Path to the audio file (supports: MP3, AAC, M4A, OGG, FLAC, WAV) */
  filePath: string;
  /** Segment size in KB (default: 512) */
  segmentSizeKB?: number;
  /** Base filename for segments (default: "file") */
  fileName?: string;
  /** Base URL path for segment URLs */
  baseUrl?: string;
  /** Enable smaller initial segments for faster startup */
  enableFastStart?: boolean;
  /** Override auto-detected format (optional) */
  format?: AudioFormat;
}

/**
 * Information about a specific segment
 */
export interface SegmentInfo {
  /** Start byte position */
  start: number;
  /** End byte position */
  end: number;
  /** Duration in seconds */
  duration: number;
}

// Re-export new parser types for public API
export type { AudioFormat, AudioFrameInfo, AudioFileInfo } from '../Parsers/IAudioParser';

/**
 * @deprecated Use AudioFrameInfo instead (Mp3FrameInfo kept for backwards compatibility)
 * Parsed MP3 frame details used for alignment and duration calculations
 */
export interface Mp3FrameInfo {
  /**
   * Zero-based frame index inside the MP3 payload
   */
  index: number;
  /** Byte offset of the frame relative to the start of the file */
  offset: number;
  /** Length of the frame in bytes */
  length: number;
  /** Duration of the frame in seconds */
  duration: number;
  /** Number of PCM samples contained in the frame */
  samples: number;
  /** Sample rate reported by the frame header */
  sampleRate: number;
  /** Bitrate of the frame in kbps */
  bitrate: number;
  /** Padding flag from the frame header */
  padding?: 0 | 1;
}

/**
 * @deprecated Use AudioFileInfo instead (Mp3FileInfo kept for backwards compatibility)
 * MP3 file metadata
 */
export interface Mp3FileInfo {
  /** File size in bytes */
  size: number;
  /** Total duration in seconds */
  duration: number;
  /** Total size of all parsed audio frames */
  audioDataSize: number;
  /** Sample rate inferred from the first valid frame */
  sampleRate?: number;
  /** Average bitrate (kbps) calculated across parsed frames */
  averageBitrate?: number;
  /** Size of the ID3v2 tag at the beginning of the file (if any) */
  id3v2Size?: number;
  /** Size of the ID3v1 tag at the end of the file (if any) */
  id3v1Size?: number;
  /** Frame table describing byte ranges and durations */
  frames: Mp3FrameInfo[];
  /** Non-fatal parsing warnings (e.g., skipped frames) */
  warnings?: string[];
}
