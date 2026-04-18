/**
 * Supported media format types (audio and video)
 */
export type MediaFormat = 'mp3' | 'aac' | 'm4a' | 'ogg' | 'flac' | 'wav' | 'mp4' | 'mov' | 'm4v';

/**
 * Unified media frame/packet information across all formats
 */
export interface MediaFrameInfo {
  /** Zero-based frame/packet index */
  index: number;
  /** Byte offset from start of file */
  offset: number;
  /** Length in bytes */
  length: number;
  /** Duration in seconds */
  duration: number;
  /** Number of PCM samples */
  samples: number;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Bitrate in kbps (may be average for VBR) */
  bitrate: number;
  /** True for video keyframes (I-frames); undefined for audio */
  keyFrame?: boolean;
}

/**
 * Unified media file metadata across all formats
 */
export interface MediaFileInfo {
  /** Detected format */
  format: MediaFormat;
  /** File size in bytes */
  size: number;
  /** Total duration in seconds */
  duration: number;
  /** Total audio/video data size (excluding metadata/headers) */
  audioDataSize: number;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Average bitrate in kbps */
  averageBitrate?: number;
  /** Bit depth (for PCM formats like WAV) */
  bitDepth?: number;
  /** Number of channels */
  channels?: number;
  /** Frame/packet table for accurate segmentation */
  frames: MediaFrameInfo[];
  /** Non-fatal parsing warnings */
  warnings?: string[];
  /** Format-specific metadata */
  metadata?: Record<string, any>;
  /** fMP4 init segment (moov box) location — present for video formats */
  initSegment?: { offset: number; length: number };
  /** Video width in pixels */
  width?: number;
  /** Video height in pixels */
  height?: number;
  /** Video frame rate */
  frameRate?: number;
}

/**
 * Interface that all media format parsers must implement
 */
export interface IMediaParser {
  /**
   * Analyze media buffer and return detailed metadata
   * @param buffer Media file buffer
   * @param opts Optional parameters (e.g., file size)
   */
  analyze(buffer: Buffer, opts?: { fileSize?: number }): MediaFileInfo;

  /**
   * Get the media format this parser handles
   */
  getFormat(): MediaFormat;

  /**
   * Quick validation that this parser can handle the buffer
   * @param buffer Media file buffer (may be partial, at least first 16 bytes)
   */
  canParse(buffer: Buffer): boolean;
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases — existing consumers using Audio* names still work
// ---------------------------------------------------------------------------

/** @deprecated Use MediaFormat instead */
export type AudioFormat = MediaFormat;

/** @deprecated Use MediaFrameInfo instead */
export type AudioFrameInfo = MediaFrameInfo;

/** @deprecated Use MediaFileInfo instead */
export type AudioFileInfo = MediaFileInfo;

/** @deprecated Use IMediaParser instead */
export type IAudioParser = IMediaParser;
