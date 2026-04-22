import { IStorageProvider } from '../Interfaces/IStorageProvider';
import { StorageProviderError } from '../errors/HlsStreamerErrors';

export interface S3ProviderOptions {
  bucket: string;
  key: string;
  /** Pre-configured S3Client instance. If not provided, clientConfig is used. */
  client?: any;
  /** Passed to `new S3Client(...)` when no client is provided. */
  clientConfig?: Record<string, any>;
  /** Override S3 command constructors — used in tests to avoid SDK dependency. */
  _commands?: {
    HeadObjectCommand: new (input: any) => any;
    GetObjectCommand: new (input: any) => any;
  };
}

export class S3Provider implements IStorageProvider {
  readonly resourceId: string;
  private readonly bucket: string;
  private readonly key: string;
  private readonly client: any;
  private readonly HeadObjectCommand: new (input: any) => any;
  private readonly GetObjectCommand: new (input: any) => any;

  constructor(options: S3ProviderOptions) {
    this.bucket = options.bucket;
    this.key = options.key;
    this.resourceId = `s3://${options.bucket}/${options.key}`;

    let sdk: any;
    if (options._commands) {
      // Test injection — no SDK needed
      sdk = options._commands;
    } else {
      try {
        sdk = require('@aws-sdk/client-s3');
      } catch {
        throw new StorageProviderError(
          '@aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3',
          this.resourceId
        );
      }
    }

    this.HeadObjectCommand = sdk.HeadObjectCommand;
    this.GetObjectCommand = sdk.GetObjectCommand;

    if (options.client) {
      this.client = options.client;
    } else {
      this.client = new sdk.S3Client(options.clientConfig ?? {});
    }
  }

  async getSize(): Promise<number> {
    try {
      const res = await this.client.send(
        new this.HeadObjectCommand({ Bucket: this.bucket, Key: this.key })
      );
      if (res.ContentLength === undefined) {
        throw new StorageProviderError('Could not determine object size', this.resourceId);
      }
      return res.ContentLength;
    } catch (err: any) {
      if (err instanceof StorageProviderError) throw err;
      throw new StorageProviderError(err.message, this.resourceId);
    }
  }

  async getRange(start: number, end: number): Promise<Buffer> {
    if (start === end) return Buffer.alloc(0);
    try {
      // S3 Range header is inclusive on both ends; our contract is half-open [start, end)
      const res = await this.client.send(
        new this.GetObjectCommand({
          Bucket: this.bucket,
          Key: this.key,
          Range: `bytes=${start}-${end - 1}`,
        })
      );
      return this.streamToBuffer(res.Body);
    } catch (err: any) {
      if (err instanceof StorageProviderError) throw err;
      throw new StorageProviderError(err.message, this.resourceId);
    }
  }

  async getHeader(): Promise<Buffer> {
    return this.getRange(0, 64);
  }

  async getBuffer(): Promise<Buffer> {
    try {
      const res = await this.client.send(
        new this.GetObjectCommand({ Bucket: this.bucket, Key: this.key })
      );
      return this.streamToBuffer(res.Body);
    } catch (err: any) {
      if (err instanceof StorageProviderError) throw err;
      throw new StorageProviderError(err.message, this.resourceId);
    }
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
