import { Mp4Parser } from '../../src/Parsers/Mp4Parser';

function buildFtypBuffer(brand: string): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeUInt32BE(16, 0);  // box size
  buf.write('ftyp', 4);
  buf.write(brand.padEnd(4, ' ').slice(0, 4), 8);
  return buf;
}

describe('Mp4Parser', () => {
  let parser: Mp4Parser;

  beforeEach(() => {
    parser = new Mp4Parser();
  });

  describe('getFormat', () => {
    it('should return mp4', () => {
      expect(parser.getFormat()).toBe('mp4');
    });
  });

  describe('canParse', () => {
    it('should accept isom brand', () => {
      const buf = buildFtypBuffer('isom');
      expect(parser.canParse(buf)).toBe(true);
    });

    it('should accept mp41 brand', () => {
      const buf = buildFtypBuffer('mp41');
      expect(parser.canParse(buf)).toBe(true);
    });

    it('should accept M4V  brand', () => {
      const buf = buildFtypBuffer('M4V ');
      expect(parser.canParse(buf)).toBe(true);
    });

    it('should reject non-ftyp buffers', () => {
      const buf = Buffer.from([0xff, 0xfb, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(parser.canParse(buf)).toBe(false);
    });

    it('should reject buffers smaller than 12 bytes', () => {
      const buf = Buffer.alloc(8);
      expect(parser.canParse(buf)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should return error result when no moov box found', () => {
      const buf = buildFtypBuffer('isom');
      const result = parser.analyze(buf, { fileSize: buf.length });
      expect(result.format).toBe('mp4');
      expect(result.duration).toBe(0);
      expect(result.frames).toHaveLength(0);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('moov');
    });

    it('should detect mov format for qt brand', () => {
      const buf = buildFtypBuffer('qt  ');
      const result = parser.analyze(buf);
      expect(result.format).toBe('mov');
    });

    it('should detect m4v format for M4V brand', () => {
      const buf = buildFtypBuffer('M4V ');
      const result = parser.analyze(buf);
      expect(result.format).toBe('m4v');
    });

    it('should detect mp4 format for isom brand', () => {
      const buf = buildFtypBuffer('isom');
      const result = parser.analyze(buf);
      expect(result.format).toBe('mp4');
    });

    it('should always set initSegment when moov is found', () => {
      // Minimal valid MP4 with moov box (no tracks)
      const ftypSize = 16;
      const moovSize = 8;
      const totalSize = ftypSize + moovSize;
      const buf = Buffer.alloc(totalSize);
      buf.writeUInt32BE(ftypSize, 0);
      buf.write('ftyp', 4);
      buf.write('isom', 8);
      buf.writeUInt32BE(moovSize, ftypSize);
      buf.write('moov', ftypSize + 4);

      const result = parser.analyze(buf, { fileSize: totalSize });
      expect(result.initSegment).toBeDefined();
      expect(result.initSegment!.offset).toBe(ftypSize);
      expect(result.initSegment!.length).toBe(moovSize);
    });
  });
});
