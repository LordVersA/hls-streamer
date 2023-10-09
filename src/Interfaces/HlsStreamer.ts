export interface HlsStreamerOption {
  filePath: string;
  eachSegmentSize?: number;
  fileName?: string;
  basePath?: string;
  lessSizeForFirst2Segments?: boolean;
}
