export interface HlsStreamerOptions {
    filePath: string;
    segmentSizeKB?: number;
    fileName?: string;
    baseUrl?: string;
    enableFastStart?: boolean;
}
export interface SegmentInfo {
    start: number;
    end: number;
    duration: number;
}
export interface Mp3FileInfo {
    size: number;
    duration: number;
}
//# sourceMappingURL=HlsStreamer.d.ts.map