import fs from "node:fs";
import { HlsStreamerOption } from "./Interfaces/HlsStreamer";
import { FileLib } from "./Libs/FileLib";

export class HlsStreamer {
  filePath: string;
  size: number = 0;
  segmentSize: number;
  audioBuffer: Buffer = Buffer.alloc(0);
  fileName: string;
  basePath: string;
  lessSizeForFirst2Segments: boolean;

  constructor(options: HlsStreamerOption) {
    this.filePath = options.filePath;
    this.segmentSize = (options.eachSegmentSize ?? 512) * 1024;
    this.fileName = options.fileName ?? "file";
    this.basePath = options.basePath ?? "";
    this.lessSizeForFirst2Segments = options.lessSizeForFirst2Segments ?? false;
  }

  loadBuffer() {
    this.audioBuffer = fs.readFileSync(this.filePath)!;
    this.size = FileLib.getFileSizeInBytes(this.audioBuffer)!;

    if (
      this.size <= 0 ||
      this.audioBuffer.length <= 0 ||
      this.segmentSize > this.size
    ) {
      throw new Error("Error on file size");
    }
  }

  async getFileBuffer(startByte: number, endByte: number): Promise<Buffer> {
    if (
      isNaN(startByte) ||
      isNaN(endByte) ||
      startByte < 0 ||
      endByte < startByte
    ) {
      throw new Error("Invalid range");
    }

    const bufferLength = endByte - startByte;

    const fd = await fs.promises.open(this.filePath, "r");

    const buffer = Buffer.alloc(bufferLength);

    await fd.read(buffer, 0, bufferLength, startByte);

    fd.close();

    return buffer;
  }

  async createM3U8() {
    this.loadBuffer();
    const parts =
      Math.ceil(
        (this.size - this.calculatefirst2SegmentSize()) / this.segmentSize
      ) + 2;

    const m3u8 = [
      `#EXTM3U`,
      `#EXT-X-VERSION:6`,
      `#EXT-X-PLAYLIST-TYPE:VOD`,
      `#EXT-X-TARGETDURATION:14`,
      `#EXT-X-MEDIA-SEQUENCE:0`,
    ];
    const segmentInfo = await Promise.all(
      Array.from({ length: parts }).map(async (_, i) => {
        const { start, end } = this.calculateSegment(i);
        const segmentData = this.audioBuffer.subarray(start, end);
        const segmentDuration = await FileLib.getMP3DurationFromBuffer(
          segmentData
        );
        const entry = {
          start,
          end,
          segmentDuration,
        };
        // console.log(
        //   `Start: \x1b[31m${start.toLocaleString()}\x1b[0m End: \x1b[32m${end.toLocaleString()}\x1b[0m Len: \x1b[34m${(
        //     end - start
        //   ).toLocaleString()}\x1b[0m`
        // );

        return entry;
      })
    );
    const segmentEntries = Array.from({ length: parts }).map((_, i) => {
      return `#EXTINF:${segmentInfo[i].segmentDuration}\n${
        this.basePath ? "/" + this.basePath : ""
      }/${segmentInfo[i].start}/${segmentInfo[i].end}/file${this.lpad(
        i,
        3
      )}.mp3`;
    });
    m3u8.push(...segmentEntries);
    m3u8.push("#EXT-X-ENDLIST");
    return m3u8.join("\n");
  }

  private calculateSegmentSize(step: number) {
    if (!this.lessSizeForFirst2Segments) {
      return this.segmentSize;
    }
    switch (step) {
      case 1:
        return this.segmentSize / 4;
      case 2:
        return this.segmentSize / 2;
      default:
        return this.segmentSize;
    }
  }

  private calculateSegment(i: number) {
    let start = 0;
    if (i < 2) {
      start = i * (this.segmentSize / 4);
    } else {
      start = (3 * this.segmentSize) / 4 + (i - 2) * this.segmentSize;
    }
    const end = Math.min(start + this.calculateSegmentSize(i + 1), this.size);
    return { end, start };
  }

  private calculatefirst2SegmentSize() {
    return (this.segmentSize / 4) * 3;
  }

  private lpad(value: number, padding: number) {
    var zeroes = new Array(padding + 1).join("0");
    return (zeroes + value).slice(-padding);
  }
}
