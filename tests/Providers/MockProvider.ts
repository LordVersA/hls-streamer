import { IStorageProvider } from '../../src/Interfaces/IStorageProvider';

export class MockStorageProvider implements IStorageProvider {
  readonly resourceId: string;
  validateSyncCalled = false;
  validateSyncError: Error | null = null;

  constructor(private readonly buffer: Buffer, id = 'mock://test') {
    this.resourceId = id;
  }

  validateSync(): void {
    this.validateSyncCalled = true;
    if (this.validateSyncError) throw this.validateSyncError;
  }

  async getSize(): Promise<number> {
    return this.buffer.length;
  }

  async getRange(start: number, end: number): Promise<Buffer> {
    if (start === end) return Buffer.alloc(0);
    return Buffer.from(this.buffer.subarray(start, end));
  }

  async getHeader(): Promise<Buffer> {
    return this.getRange(0, Math.min(64, this.buffer.length));
  }

  async getBuffer(): Promise<Buffer> {
    return Buffer.from(this.buffer);
  }
}
