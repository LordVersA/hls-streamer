/**
 * Supported audio format types
 */
export type AudioFormat = 'mp3' | 'aac' | 'm4a' | 'ogg' | 'flac' | 'wav';

/**
 * Unified audio frame/packet information across all formats
 */
export interface AudioFrameInfo {
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
}

/**
 * Unified audio file metadata across all formats
 */
export interface AudioFileInfo {
  /** Detected format */
  format: AudioFormat;
  /** File size in bytes */
  size: number;
  /** Total duration in seconds */
  duration: number;
  /** Total audio data size (excluding metadata/headers) */
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
  frames: AudioFrameInfo[];
  /** Non-fatal parsing warnings */
  warnings?: string[];
  /** Format-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Abstract interface that all audio format parsers must implement
 */
export interface IAudioParser {
  /**
   * Analyze audio buffer and return detailed metadata
   * @param buffer Audio file buffer
   * @param opts Optional parameters (e.g., file size)
   */
  analyze(buffer: Buffer, opts?: { fileSize?: number }): AudioFileInfo;

  /**
   * Get the audio format this parser handles
   */
  getFormat(): AudioFormat;

  /**
   * Quick validation that this parser can handle the buffer
   * @param buffer Audio file buffer (may be partial, at least first 16 bytes)
   */
  canParse(buffer: Buffer): boolean;
}
