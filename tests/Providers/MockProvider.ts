import { IStorageProvider } from '../../src/Interfaces/IStorageProvider';

export class MockStorageProvider implements IStorageProvider {
  readonly resourceId: string;
  validateSyncCalled = false;
  validateSyncError: Error | null = null;

  getSizeCalls = 0;
  getRangeCalls = 0;
  getHeaderCalls = 0;
  getBufferCalls = 0;

  constructor(private readonly buffer: Buffer, id = 'mock://test') {
    this.resourceId = id;
  }

  validateSync(): void {
    this.validateSyncCalled = true;
    if (this.validateSyncError) throw this.validateSyncError;
  }

  async getSize(): Promise<number> {
    this.getSizeCalls++;
    return this.buffer.length;
  }

  async getRange(start: number, end: number): Promise<Buffer> {
    this.getRangeCalls++;
    if (start === end) return Buffer.alloc(0);
    return Buffer.from(this.buffer.subarray(start, end));
  }

  async getHeader(): Promise<Buffer> {
    this.getHeaderCalls++;
    if (this.buffer.length === 0) return Buffer.alloc(0);
    return Buffer.from(this.buffer.subarray(0, Math.min(64, this.buffer.length)));
  }

  async getBuffer(): Promise<Buffer> {
    this.getBufferCalls++;
    return Buffer.from(this.buffer);
  }

  resetCallCounts(): void {
    this.getSizeCalls = 0;
    this.getRangeCalls = 0;
    this.getHeaderCalls = 0;
    this.getBufferCalls = 0;
  }
}
