/**
 * Configuration options for HLS streamer
 */
export interface HlsStreamerOptions {
  /** Path to the MP3 file */
  filePath: string;
  /** Segment size in KB (default: 512) */
  segmentSizeKB?: number;
  /** Base filename for segments (default: "file") */
  fileName?: string;
  /** Base URL path for segment URLs */
  baseUrl?: string;
  /** Enable smaller initial segments for faster startup */
  enableFastStart?: boolean;
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

/**
 * MP3 file metadata
 */
export interface Mp3FileInfo {
  /** File size in bytes */
  size: number;
  /** Total duration in seconds */
  duration: number;
}
