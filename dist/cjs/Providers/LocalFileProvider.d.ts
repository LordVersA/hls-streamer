import { IStorageProvider } from '../Interfaces/IStorageProvider';
export declare class LocalFileProvider implements IStorageProvider {
    private readonly filePath;
    readonly resourceId: string;
    constructor(filePath: string);
    validateSync(): void;
    getSize(): Promise<number>;
    getRange(start: number, end: number): Promise<Buffer>;
    getHeader(): Promise<Buffer>;
    getBuffer(): Promise<Buffer>;
}
//# sourceMappingURL=LocalFileProvider.d.ts.map