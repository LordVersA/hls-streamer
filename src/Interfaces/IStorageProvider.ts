export interface IStorageProvider {
  readonly resourceId?: string;
  getSize(): Promise<number>;
  /** Returns bytes [start, end) — half-open range */
  getRange(start: number, end: number): Promise<Buffer>;
  /** Returns first 64 bytes for format detection */
  getHeader(): Promise<Buffer>;
  /** Returns the full file buffer — called once, result cached by HlsStreamer */
  getBuffer(): Promise<Buffer>;
  /** Synchronous validation (local files only); no-op for remote providers */
  validateSync?(): void;
}
