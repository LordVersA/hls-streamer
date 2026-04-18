import { MediaFormat } from '../Parsers/IMediaParser';
export interface HlsStreamerOptions {
    filePath: string;
    segmentSizeKB?: number;
    fileName?: string;
    baseUrl?: string;
    enableFastStart?: boolean;
    format?: MediaFormat;
}
export interface SegmentInfo {
    start: number;
    end: number;
    duration: number;
}
export type { MediaFormat, MediaFrameInfo, MediaFileInfo, IMediaParser } from '../Parsers/IMediaParser';
export type { AudioFormat, AudioFrameInfo, AudioFileInfo, IAudioParser } from '../Parsers/IMediaParser';
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
//# sourceMappingURL=HlsStreamer.d.ts.map