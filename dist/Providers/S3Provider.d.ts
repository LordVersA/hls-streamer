import { IStorageProvider } from '../Interfaces/IStorageProvider';
export interface S3ProviderOptions {
    bucket: string;
    key: string;
    client?: any;
    clientConfig?: Record<string, any>;
    _commands?: {
        HeadObjectCommand: new (input: any) => any;
        GetObjectCommand: new (input: any) => any;
    };
}
export declare class S3Provider implements IStorageProvider {
    readonly resourceId: string;
    private readonly bucket;
    private readonly key;
    private readonly client;
    private readonly HeadObjectCommand;
    private readonly GetObjectCommand;
    constructor(options: S3ProviderOptions);
    getSize(): Promise<number>;
    getRange(start: number, end: number): Promise<Buffer>;
    getHeader(): Promise<Buffer>;
    getBuffer(): Promise<Buffer>;
    private streamToBuffer;
}
//# sourceMappingURL=S3Provider.d.ts.map