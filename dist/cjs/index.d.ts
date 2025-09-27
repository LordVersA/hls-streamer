import { HlsStreamerOptions } from "./Interfaces/HlsStreamer";
export declare class HlsStreamer {
    private readonly filePath;
    private readonly segmentSize;
    private readonly fileName;
    private readonly baseUrl;
    private readonly enableFastStart;
    private fileInfo?;
    private segmentCache;
    constructor(options: HlsStreamerOptions);
    private validateOptions;
    private validateFile;
    private getFileInfo;
    getFileBuffer(startByte: number, endByte: number): Promise<Buffer>;
    createM3U8(): Promise<string>;
    private calculateSegmentCount;
    private estimateSegmentDuration;
    private buildSegmentUrl;
    private calculateSegmentSize;
    private calculateSegment;
    private calculatefirst2SegmentSize;
    private padNumber;
    getSegmentDuration(segmentIndex: number): Promise<number>;
}
export * from './Interfaces/HlsStreamer';
export * from './errors/HlsStreamerErrors';
//# sourceMappingURL=index.d.ts.map