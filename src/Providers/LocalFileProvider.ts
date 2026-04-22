import fs from 'node:fs';
import { IStorageProvider } from '../Interfaces/IStorageProvider';
import { FileNotFoundError, InvalidFileError } from '../errors/HlsStreamerErrors';

export class LocalFileProvider implements IStorageProvider {
  readonly resourceId: string;

  constructor(private readonly filePath: string) {
    this.resourceId = filePath;
  }

  validateSync(): void {
    if (!fs.existsSync(this.filePath)) {
      throw new FileNotFoundError(this.filePath);
    }
    const stat = fs.statSync(this.filePath);
    if (!stat.isFile()) {
      throw new InvalidFileError('Path is not a file');
    }
  }

  async getSize(): Promise<number> {
    const stat = await fs.promises.stat(this.filePath);
    return stat.size;
  }

  async getRange(start: number, end: number): Promise<Buffer> {
    const length = end - start;
    if (length === 0) return Buffer.alloc(0);
    const fd = fs.openSync(this.filePath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const bytesRead = fs.readSync(fd, buffer as any, 0, length, start);
      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  }

  async getHeader(): Promise<Buffer> {
    return this.getRange(0, 64);
  }

  async getBuffer(): Promise<Buffer> {
    return fs.promises.readFile(this.filePath);
  }
}
