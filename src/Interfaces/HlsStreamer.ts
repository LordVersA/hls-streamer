export interface HlsStreamerOption {
  filePath: string;
  eachSegmentSize?: number;
  fileName?: string;
  basePath?: string;
  salt?: string;
  lessSizeForFirst2Segments?: boolean;
}
