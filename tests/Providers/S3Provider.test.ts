import { S3Provider, S3ProviderOptions } from '../../src/Providers/S3Provider';
import { StorageProviderError } from '../../src/errors/HlsStreamerErrors';

const makeStream = (data: Buffer) => {
  async function* gen() { yield data; }
  return gen();
};

/** Build S3ProviderOptions with injected mock commands and a mock client. */
const makeOptions = (clientSendImpl: jest.Mock): S3ProviderOptions => {
  const HeadObjectCommand = jest.fn((input: any) => ({ type: 'HeadObject', input }));
  const GetObjectCommand = jest.fn((input: any) => ({ type: 'GetObject', input }));
  return {
    bucket: 'my-bucket',
    key: 'audio/track.mp3',
    client: { send: clientSendImpl },
    _commands: { HeadObjectCommand, GetObjectCommand },
  };
};

describe('S3Provider', () => {
  const bucket = 'my-bucket';
  const key = 'audio/track.mp3';

  describe('constructor', () => {
    it('should set resourceId to s3://bucket/key', () => {
      const opts = makeOptions(jest.fn());
      const provider = new S3Provider(opts);
      expect(provider.resourceId).toBe(`s3://${bucket}/${key}`);
    });

    it('should throw StorageProviderError when SDK is not installed and no client given', () => {
      // No _commands injected and no SDK installed — must throw StorageProviderError
      expect(() =>
        new S3Provider({ bucket, key })
      ).toThrow(StorageProviderError);
    });

    it('should throw StorageProviderError with helpful install message', () => {
      expect(() =>
        new S3Provider({ bucket, key })
      ).toThrow('@aws-sdk/client-s3 is not installed');
    });
  });

  describe('getSize', () => {
    it('should return ContentLength from HeadObject response', async () => {
      const send = jest.fn().mockResolvedValueOnce({ ContentLength: 1024 });
      const provider = new S3Provider(makeOptions(send));
      const size = await provider.getSize();
      expect(size).toBe(1024);
    });

    it('should throw StorageProviderError when ContentLength is missing', async () => {
      const send = jest.fn().mockResolvedValueOnce({});
      const provider = new S3Provider(makeOptions(send));
      await expect(provider.getSize()).rejects.toThrow(StorageProviderError);
    });

    it('should throw StorageProviderError on SDK error', async () => {
      const send = jest.fn().mockRejectedValueOnce(new Error('Access Denied'));
      const provider = new S3Provider(makeOptions(send));
      await expect(provider.getSize()).rejects.toThrow(StorageProviderError);
    });

    it('should include resourceId in error message', async () => {
      const send = jest.fn().mockRejectedValueOnce(new Error('NoSuchKey'));
      const provider = new S3Provider(makeOptions(send));
      await expect(provider.getSize()).rejects.toThrow(`s3://${bucket}/${key}`);
    });
  });

  describe('getRange', () => {
    it('should send correct inclusive Range header for getRange(0, 64)', async () => {
      const data = Buffer.alloc(64);
      const send = jest.fn().mockResolvedValueOnce({ Body: makeStream(data) });
      const provider = new S3Provider(makeOptions(send));

      await provider.getRange(0, 64);

      const sentCommand = send.mock.calls[0]![0];
      expect(sentCommand.input.Range).toBe('bytes=0-63');
    });

    it('should send Range bytes=10-49 for getRange(10, 50)', async () => {
      const data = Buffer.alloc(40);
      const send = jest.fn().mockResolvedValueOnce({ Body: makeStream(data) });
      const provider = new S3Provider(makeOptions(send));

      await provider.getRange(10, 50);

      const sentCommand = send.mock.calls[0]![0];
      expect(sentCommand.input.Range).toBe('bytes=10-49');
    });

    it('should return empty buffer for zero-length range without calling send', async () => {
      const send = jest.fn();
      const provider = new S3Provider(makeOptions(send));
      const result = await provider.getRange(10, 10);
      expect(result.length).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });

    it('should concatenate multiple stream chunks', async () => {
      async function* multiChunk() {
        yield Buffer.from('hello');
        yield Buffer.from(' ');
        yield Buffer.from('world');
      }
      const send = jest.fn().mockResolvedValueOnce({ Body: multiChunk() });
      const provider = new S3Provider(makeOptions(send));
      const result = await provider.getRange(0, 11);
      expect(result.toString()).toBe('hello world');
    });

    it('should throw StorageProviderError on SDK error', async () => {
      const send = jest.fn().mockRejectedValueOnce(new Error('Network failure'));
      const provider = new S3Provider(makeOptions(send));
      await expect(provider.getRange(0, 100)).rejects.toThrow(StorageProviderError);
    });

    it('should pass Bucket and Key to GetObjectCommand', async () => {
      const data = Buffer.alloc(10);
      const send = jest.fn().mockResolvedValueOnce({ Body: makeStream(data) });
      const provider = new S3Provider(makeOptions(send));
      await provider.getRange(0, 10);
      const sentCommand = send.mock.calls[0]![0];
      expect(sentCommand.input.Bucket).toBe(bucket);
      expect(sentCommand.input.Key).toBe(key);
    });
  });

  describe('getHeader', () => {
    it('should request bytes=0-63 (first 64 bytes)', async () => {
      const send = jest.fn().mockResolvedValueOnce({ Body: makeStream(Buffer.alloc(64)) });
      const provider = new S3Provider(makeOptions(send));
      await provider.getHeader();
      const sentCommand = send.mock.calls[0]![0];
      expect(sentCommand.input.Range).toBe('bytes=0-63');
    });

    it('should return a Buffer of 64 bytes', async () => {
      const send = jest.fn().mockResolvedValueOnce({ Body: makeStream(Buffer.alloc(64)) });
      const provider = new S3Provider(makeOptions(send));
      const header = await provider.getHeader();
      expect(header.length).toBe(64);
    });
  });

  describe('getBuffer', () => {
    it('should send GetObjectCommand without a Range header', async () => {
      const data = Buffer.from('full file content');
      const send = jest.fn().mockResolvedValueOnce({ Body: makeStream(data) });
      const provider = new S3Provider(makeOptions(send));
      await provider.getBuffer();
      const sentCommand = send.mock.calls[0]![0];
      expect(sentCommand.input.Range).toBeUndefined();
    });

    it('should return the correct full content', async () => {
      const data = Buffer.from('full file content');
      const send = jest.fn().mockResolvedValueOnce({ Body: makeStream(data) });
      const provider = new S3Provider(makeOptions(send));
      const result = await provider.getBuffer();
      expect(result).toEqual(data);
    });

    it('should throw StorageProviderError on SDK error', async () => {
      const send = jest.fn().mockRejectedValueOnce(new Error('Forbidden'));
      const provider = new S3Provider(makeOptions(send));
      await expect(provider.getBuffer()).rejects.toThrow(StorageProviderError);
    });
  });
});
