# HLS Streamer

[![npm version](https://badge.fury.io/js/hls-streamer.svg)](https://badge.fury.io/js/hls-streamer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

HLS Streamer turns any MP3 into an HTTP Live Streaming (HLS) playlist on the fly. It analyses the source audio in-memory, builds frame-aligned byte ranges, and streams them without temporary files, native bindings, or external binaries like ffmpeg.

---

- [Why HLS Streamer?](#why-hls-streamer)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Serving Over HTTP](#serving-over-http)
- [Configuration Reference](#configuration-reference)
- [Playlist Anatomy](#playlist-anatomy)
- [Operational Tips](#operational-tips)
- [Development](#development)
- [Support](#support)

## Why HLS Streamer?

- **Zero dependencies** – no shared libraries, no ffmpeg, no native compilation. Drop it into Docker, serverless, or edge runtimes.
- **Accurate segments** – real MP3 frame parsing provides true durations, `#EXTINF` metadata, and target durations that match playback.
- **Frame-aligned byte ranges** – every segment begins and ends on verified MP3 frame boundaries, preventing pops and clipped audio.
- **No temp files** – streams straight from the source MP3 using byte-range reads.
- **Fast-start aware** – optional smaller first segments improve startup latency for constrained networks.
- **TypeScript first** – authored in TypeScript with full type definitions for your tooling and IDEs.

## How It Works

1. **Metadata analysis** – the package inspects ID3v2/ID3v1 tags, parses MP3 frame headers, and produces a frame table with offsets, durations, and bitrates.
2. **Segment planning** – segment boundaries are calculated from the frame table so each segment contains whole frames while matching your target sizes.
3. **Playlist generation** – `createM3U8()` emits an `#EXTM3U` playlist with accurate `#EXTINF` entries and `#EXT-X-TARGETDURATION` derived from the longest segment.
4. **On-demand byte ranges** – `getFileBuffer(start, end)` streams the exact bytes for a segment without reading the entire file into memory.

```
┌─────────────┐        ┌────────────────┐        ┌────────────────┐
│  MP3 Source │ ─────▶ │ Frame Analyzer │ ─────▶ │ Segment Planner│
└─────────────┘        └────────────────┘        └────────┬───────┘
                                                            │
                                                            ▼
                                               ┌──────────────────────┐
                                               │ HLS Playlist & Bytes │
                                               └──────────────────────┘
```

## Quick Start

```ts
import { HlsStreamer } from 'hls-streamer';

const streamer = new HlsStreamer({
  filePath: '/media/library/song.mp3',
  segmentSizeKB: 512,
  fileName: 'track',
  baseUrl: 'audio/stream/session-42',
  enableFastStart: true,
});

const playlist = await streamer.createM3U8();
console.log(playlist);

const firstSegmentBuffer = await streamer.getFileBuffer(0, 512 * 1024);
```

## Serving Over HTTP

Create playlists and segment endpoints with any HTTP framework. The example below shows an Express setup:

```ts
import express from 'express';
import { HlsStreamer } from 'hls-streamer';

const app = express();

app.get('/streams/:id/playlist.m3u8', async (req, res, next) => {
  try {
    const streamer = new HlsStreamer({
      filePath: resolveAudioPath(req.params.id),
      baseUrl: `streams/${req.params.id}`,
      enableFastStart: true,
    });

    res.type('application/vnd.apple.mpegurl');
    res.send(await streamer.createM3U8());
  } catch (error) {
    next(error);
  }
});

app.get('/streams/:id/:start/:end/:filename', async (req, res, next) => {
  try {
    const streamer = new HlsStreamer({
      filePath: resolveAudioPath(req.params.id),
      baseUrl: `streams/${req.params.id}`,
    });

    const start = Number(req.params.start);
    const end = Number(req.params.end);

    res.type('audio/mpeg');
    res.set('Accept-Ranges', 'bytes');
    res.send(await streamer.getFileBuffer(start, end));
  } catch (error) {
    next(error);
  }
});
```

### Segment URL Contract

Generated playlists follow the pattern below:

```
/{baseUrl}/{startByte}/{endByte}/{fileName}{index}.mp3
```

- `startByte` is inclusive, `endByte` is exclusive.
- `index` is zero-padded to three digits (`000`, `001`, ...).
- Use the provided byte range as-is when serving `audio/mpeg` responses.

## Configuration Reference

| Option              | Type      | Default | Description |
| ------------------- | --------- | ------- | ----------- |
| `filePath`          | `string`  | —       | Absolute or relative path to the MP3 file. |
| `segmentSizeKB`     | `number`  | `512`   | Target segment size in kilobytes. Fast-start mode splits the first two segments into quarters/halves of this value. |
| `fileName`          | `string`  | `"file"` | Base name used in generated segment URLs (the index is appended automatically). |
| `baseUrl`           | `string`  | `""`   | URL prefix inserted before each segment path. Useful when mounting under a route or CDN prefix. |
| `enableFastStart`   | `boolean` | `false` | When true, the first two segments are smaller to reduce initial buffering time. |

### API Surface

- `createM3U8(): Promise<string>` – Returns a full playlist with frame-accurate durations.
- `getFileBuffer(start: number, end: number): Promise<Buffer>` – Streams a byte range from the MP3.
- `getSegmentDuration(index: number): Promise<number>` – Reads the cached segment table to return the duration of a segment in seconds.

Custom error classes are exported to help with error handling: `FileNotFoundError`, `InvalidFileError`, `InvalidRangeError`, and `InvalidParameterError`.

## Playlist Anatomy

```m3u8
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:5.973,
/audio/session/0/260736/track000.mp3
#EXTINF:5.994,
/audio/session/260736/521472/track001.mp3
...
#EXT-X-ENDLIST
```

- `#EXT-X-TARGETDURATION` is rounded up from the longest real segment duration.
- `#EXTINF` entries retain millisecond precision for smooth playback on strict clients.
- Segment paths directly encode the byte ranges your route must return.

## Operational Tips

- **Caching** – Construct the streamer once per unique MP3 and reuse it. Segment planning caches the metadata, so repeated calls to `createM3U8()` or `getSegmentDuration()` are cheap.
- **CDN friendliness** – Because segment URLs are deterministic byte ranges, edge caches can serve them efficiently. Configure consistent caching headers (e.g. `Cache-Control: public, max-age=86400`).
- **Serverless** – The zero-dependency design works well in Lambda/Cloud Functions. For large MP3s, prefer streaming reads (`getFileBuffer`) instead of loading entire files into memory.
- **Monitoring** – Log segment `start`/`end` pairs and durations to correlate playback issues with specific byte ranges or frame parsing warnings.
- **Troubleshooting** – For corrupted MP3s, inspect `FileLib.analyzeMP3File()` (available internally) to review parsing warnings and ID3 metadata.

## Development

Clone the repo, install dependencies, and run the usual scripts:

```bash
npm install
npm test -- --runInBand --watchman=false
npm run build
```

The Jest flag `--watchman=false` avoids macOS sandbox issues when running in restricted environments.

To explore the example playlist generator, see `example/test-hls-generation.js` and the bundled `example/sample.mp3` fixture.

## Support

- 🐛 Bug reports: [GitHub Issues](https://github.com/LordVersA/hls-streamer/issues)
- 💬 Questions & ideas: [GitHub Discussions](https://github.com/LordVersA/hls-streamer/discussions)
- 📦 npm registry: [hls-streamer](https://www.npmjs.com/package/hls-streamer)

## Contributing

Contributions are welcome! Please open an issue to discuss substantial changes before submitting a pull request. Make sure `npm test -- --runInBand --watchman=false` and `npm run build` pass prior to filing the PR.

---

Made with ❤️ by [LordVersA](https://github.com/LordVersA)
