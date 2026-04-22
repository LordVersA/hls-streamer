import { StorageProviderError } from '../errors/HlsStreamerErrors';
export class S3Provider {
    constructor(options) {
        Object.defineProperty(this, "resourceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bucket", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "key", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "HeadObjectCommand", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "GetObjectCommand", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.bucket = options.bucket;
        this.key = options.key;
        this.resourceId = `s3://${options.bucket}/${options.key}`;
        let sdk;
        if (options._commands) {
            sdk = options._commands;
        }
        else {
            try {
                sdk = require('@aws-sdk/client-s3');
            }
            catch {
                throw new StorageProviderError('@aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3', this.resourceId);
            }
        }
        this.HeadObjectCommand = sdk.HeadObjectCommand;
        this.GetObjectCommand = sdk.GetObjectCommand;
        if (options.client) {
            this.client = options.client;
        }
        else {
            this.client = new sdk.S3Client(options.clientConfig ?? {});
        }
    }
    async getSize() {
        try {
            const res = await this.client.send(new this.HeadObjectCommand({ Bucket: this.bucket, Key: this.key }));
            if (res.ContentLength === undefined) {
                throw new StorageProviderError('Could not determine object size', this.resourceId);
            }
            return res.ContentLength;
        }
        catch (err) {
            if (err instanceof StorageProviderError)
                throw err;
            throw new StorageProviderError(err.message, this.resourceId);
        }
    }
    async getRange(start, end) {
        if (start === end)
            return Buffer.alloc(0);
        try {
            const res = await this.client.send(new this.GetObjectCommand({
                Bucket: this.bucket,
                Key: this.key,
                Range: `bytes=${start}-${end - 1}`,
            }));
            return this.streamToBuffer(res.Body);
        }
        catch (err) {
            if (err instanceof StorageProviderError)
                throw err;
            throw new StorageProviderError(err.message, this.resourceId);
        }
    }
    async getHeader() {
        return this.getRange(0, 64);
    }
    async getBuffer() {
        try {
            const res = await this.client.send(new this.GetObjectCommand({ Bucket: this.bucket, Key: this.key }));
            return this.streamToBuffer(res.Body);
        }
        catch (err) {
            if (err instanceof StorageProviderError)
                throw err;
            throw new StorageProviderError(err.message, this.resourceId);
        }
    }
    async streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
}
//# sourceMappingURL=S3Provider.js.map