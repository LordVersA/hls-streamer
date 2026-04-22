export interface IStorageProvider {
    readonly resourceId?: string;
    getSize(): Promise<number>;
    getRange(start: number, end: number): Promise<Buffer>;
    getHeader(): Promise<Buffer>;
    getBuffer(): Promise<Buffer>;
    validateSync?(): void;
}
//# sourceMappingURL=IStorageProvider.d.ts.map