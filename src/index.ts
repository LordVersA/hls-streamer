import fs from "node:fs";
import { FileLib } from "./Libs/FileLib";
import { HlsStreamerOption } from "./Interfaces/HlsStreamer";

export class HlsStreamer {
  filePath: string;
  eachSegmentSize: number;
  fileName: string;
  basePath: string;
  lessSizeForFirst2Segments: boolean;

  constructor(options: HlsStreamerOption) {
    this.filePath = options.filePath;
    this.eachSegmentSize = options.eachSegmentSize ?? 512;
    this.fileName = options.fileName ?? "file";
    this.basePath = options.basePath ?? "";
    this.lessSizeForFirst2Segments = options.lessSizeForFirst2Segments ?? false;
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
    const audioBuffer = fs.readFileSync(this.filePath);
    const size = FileLib.getFileSizeInBytes(audioBuffer);
    const segmentSize = 1024 * this.eachSegmentSize;
    const parts = Math.ceil(size / segmentSize); // Use Math.ceil to ensure all data is processed

    const m3u8 = [
      `#EXTM3U`,
      `#EXT-X-VERSION:6`,
      `#EXT-X-PLAYLIST-TYPE:VOD`,
      `#EXT-X-TARGETDURATION:14`,
      `#EXT-X-MEDIA-SEQUENCE:0`,
    ];

    // Pre-calculate segment durations
    const segmentInfo = await Promise.all(
      Array.from({ length: parts }).map(async (_, i) => {
        let start = this.calculateSegmentSize(i, segmentSize) * i;
        const end = Math.min(
          start + this.calculateSegmentSize(i + 1, segmentSize),
          size
        );
        const segmentData = audioBuffer.subarray(start, end);
        const segmentDuration = await FileLib.getMP3DurationFromBuffer(
          segmentData
        );
        const entry = {
          start,
          end,
          segmentDuration,
        };
        // start = end;

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

  private calculateSegmentSize(step: number, segmentSize: number) {
    if (!this.lessSizeForFirst2Segments) {
      return segmentSize;
    }
    switch (step) {
      case 0:
        return 0;
      case 1:
        return segmentSize / 4;
      case 2:
        return segmentSize / 2;
      default:
        return segmentSize;
    }
  }

  private lpad(value: number, padding: number) {
    var zeroes = new Array(padding + 1).join("0");
    return (zeroes + value).slice(-padding);
  }
}
