import { MediaFormat } from '../Parsers/IMediaParser';
import { IStorageProvider } from './IStorageProvider';

export type { IStorageProvider };

type LocalFileSource = {
  /** Path to the local media file */
  filePath: string;
  storageProvider?: never;
};

type RemoteStorageSource = {
  /** Remote storage provider (e.g. S3Provider) */
  storageProvider: IStorageProvider;
  filePath?: never;
};

type SharedOptions = {
  /** Segment size in KB (default: 512) */
  segmentSizeKB?: number;
  /** Base filename for segments (default: "file") */
  fileName?: string;
  /** Base URL path for segment URLs */
  baseUrl?: string;
  /** Enable smaller initial segments for faster startup */
  enableFastStart?: boolean;
  /** Override auto-detected format (optional) */
  format?: MediaFormat;
};

/**
 * Configuration options for HLS streamer.
 * Provide either `filePath` (local) or `storageProvider` (remote) — not both.
 */
export type HlsStreamerOptions = (LocalFileSource | RemoteStorageSource) & SharedOptions;

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

// Re-export new Media* types as the primary public API
export type { MediaFormat, MediaFrameInfo, MediaFileInfo, IMediaParser } from '../Parsers/IMediaParser';

// Backward-compatible Audio* aliases — consumers using these names still compile
export type { AudioFormat, AudioFrameInfo, AudioFileInfo, IAudioParser } from '../Parsers/IMediaParser';

/**
 * @deprecated Use MediaFrameInfo instead
 */
export interface Mp3FrameInfo {
  index: number;
  offset: number;
  length: number;
  duration: number;
  samples: number;
  sampleRate: number;
  bitrate: number;
  padding?: 0 | 1;
}

/**
 * @deprecated Use MediaFileInfo instead
 */
export interface Mp3FileInfo {
  size: number;
  duration: number;
  audioDataSize: number;
  sampleRate?: number;
  averageBitrate?: number;
  id3v2Size?: number;
  id3v1Size?: number;
  frames: Mp3FrameInfo[];
  warnings?: string[];
}
