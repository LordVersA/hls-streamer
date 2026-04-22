import { HlsStreamerOptions } from "./Interfaces/HlsStreamer";
export declare class HlsStreamer {
    private readonly provider;
    private readonly segmentSize;
    private readonly fileName;
    private readonly baseUrl;
    private readonly enableFastStart;
    private readonly formatOverride;
    private fileInfo?;
    private segments;
    constructor(options: HlsStreamerOptions);
    private validateOptions;
    private validateFormat;
    private getFileInfo;
    getFileBuffer(startByte: number, endByte: number): Promise<Buffer>;
    createM3U8(): Promise<string>;
    private getSegments;
    private computeTargetSizes;
    private computeTargetSizesFromBytes;
    private buildSegmentsWithoutFrameTable;
    private estimateSegmentDuration;
    private buildSegmentUrl;
    private calculateSegmentSize;
    private padNumber;
    getMediaType(): Promise<'audio' | 'video'>;
    getSegmentDuration(segmentIndex: number): Promise<number>;
}
export * from './Interfaces/HlsStreamer';
export * from './errors/HlsStreamerErrors';
export { LocalFileProvider } from './Providers/LocalFileProvider';
export { S3Provider } from './Providers/S3Provider';
export type { S3ProviderOptions } from './Providers/S3Provider';
//# sourceMappingURL=index.d.ts.map