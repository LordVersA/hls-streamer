export type AudioFormat = 'mp3' | 'aac' | 'm4a' | 'ogg' | 'flac' | 'wav';
export interface AudioFrameInfo {
    index: number;
    offset: number;
    length: number;
    duration: number;
    samples: number;
    sampleRate: number;
    bitrate: number;
}
export interface AudioFileInfo {
    format: AudioFormat;
    size: number;
    duration: number;
    audioDataSize: number;
    sampleRate?: number;
    averageBitrate?: number;
    bitDepth?: number;
    channels?: number;
    frames: AudioFrameInfo[];
    warnings?: string[];
    metadata?: Record<string, any>;
}
export interface IAudioParser {
    analyze(buffer: Buffer, opts?: {
        fileSize?: number;
    }): AudioFileInfo;
    getFormat(): AudioFormat;
    canParse(buffer: Buffer): boolean;
}
//# sourceMappingURL=IAudioParser.d.ts.map