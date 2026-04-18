export type MediaFormat = 'mp3' | 'aac' | 'm4a' | 'ogg' | 'flac' | 'wav' | 'mp4' | 'mov' | 'm4v';
export interface MediaFrameInfo {
    index: number;
    offset: number;
    length: number;
    duration: number;
    samples: number;
    sampleRate: number;
    bitrate: number;
    keyFrame?: boolean;
}
export interface MediaFileInfo {
    format: MediaFormat;
    size: number;
    duration: number;
    audioDataSize: number;
    sampleRate?: number;
    averageBitrate?: number;
    bitDepth?: number;
    channels?: number;
    frames: MediaFrameInfo[];
    warnings?: string[];
    metadata?: Record<string, any>;
    initSegment?: {
        offset: number;
        length: number;
    };
    width?: number;
    height?: number;
    frameRate?: number;
}
export interface IMediaParser {
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): MediaFileInfo;
    getFormat(): MediaFormat;
    canParse(buffer: Buffer): boolean;
}
export type AudioFormat = MediaFormat;
export type AudioFrameInfo = MediaFrameInfo;
export type AudioFileInfo = MediaFileInfo;
export type IAudioParser = IMediaParser;
//# sourceMappingURL=IMediaParser.d.ts.map