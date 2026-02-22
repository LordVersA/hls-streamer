# HLS Streamer

[![npm version](https://badge.fury.io/js/hls-streamer.svg)](https://badge.fury.io/js/hls-streamer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

HLS Streamer turns any audio file (MP3, AAC, M4A, OGG Vorbis, FLAC, WAV) into an HTTP Live Streaming (HLS) playlist on the fly. It analyses the source audio in-memory, builds frame-aligned byte ranges, and streams them without temporary files, native bindings, or external binaries like ffmpeg.

---

- [Why HLS Streamer?](#why-hls-streamer)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Serving Over HTTP](#serving-over-http)
- [Configuration Reference](#configuration-reference)
- [Playlist Anatomy](#playlist-anatomy)
- [Operational Tips](#operational-tips)
- [Development](#development)
- [Release Notes](#release-notes)
- [Support](#support)

## Why HLS Streamer?

- **Multi-format support** – handles MP3, AAC, M4A, OGG Vorbis, FLAC, and WAV with automatic format detection.
- **Zero dependencies** – no shared libraries, no ffmpeg, no native compilation. Pure TypeScript parsers for all formats. Drop it into Docker, serverless, or edge runtimes.
- **Accurate segments** – real audio frame/packet parsing provides true durations, `#EXTINF` metadata, and target durations that match playback.
- **Frame-aligned byte ranges** – every segment begins and ends on verified frame/packet boundaries, preventing pops and clipped audio.
- **No temp files** – streams straight from the source audio file using byte-range reads.
- **Fast-start aware** – optional smaller first segments improve startup latency for constrained networks.
- **TypeScript first** – authored in TypeScript with full type definitions for your tooling and IDEs.

## How It Works

1. **Format detection** – automatically detects audio format from file content (magic bytes) or extension, with optional manual override.
2. **Metadata analysis** – format-specific parsers extract metadata (ID3/Vorbis comments/etc.), parse frame/packet headers, and produce a frame table with offsets, durations, and bitrates.
3. **Segment planning** – segment boundaries are calculated from the frame table so each segment contains whole frames/packets while matching your target sizes.
4. **Playlist generation** – `createM3U8()` emits an `#EXTM3U` playlist with accurate `#EXTINF` entries and `#EXT-X-TARGETDURATION` derived from the longest segment.
5. **On-demand byte ranges** – `getFileBuffer(start, end)` streams the exact bytes for a segment without reading the entire file into memory.

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│ Audio Source │ ──▶ │ Format Detector │ ──▶ │ Format Parser   │ ──▶ │ Segment Planner      │
│ (any format) │     │ (magic bytes)   │     │ (MP3/AAC/etc.)  │     │ (frame-aligned)      │
└──────────────┘     └─────────────────┘     └─────────────────┘     └──────────┬───────────┘
                                                                                  │
                                                                                  ▼
                                                                     ┌──────────────────────┐
                                                                     │ HLS Playlist & Bytes │
                                                                     └──────────────────────┘
```

## Quick Start

```ts
import { HlsStreamer } from 'hls-streamer';

// Works with any supported format - auto-detected!
const streamer = new HlsStreamer({
  filePath: '/media/library/song.mp3', // or .aac, .m4a, .ogg, .flac, .wav
  segmentSizeKB: 512,
  fileName: 'track',
  baseUrl: 'audio/stream/session-42',
  enableFastStart: true,
  // format: 'mp3' // optional: override auto-detection
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
| `filePath`          | `string`  | —       | Absolute or relative path to the audio file. Supports: MP3, AAC, M4A, OGG, FLAC, WAV. |
| `segmentSizeKB`     | `number`  | `512`   | Target segment size in kilobytes. Fast-start mode splits the first two segments into quarters/halves of this value. |
| `fileName`          | `string`  | `"file"` | Base name used in generated segment URLs (the index is appended automatically). |
| `baseUrl`           | `string`  | `""`   | URL prefix inserted before each segment path. Useful when mounting under a route or CDN prefix. |
| `enableFastStart`   | `boolean` | `false` | When true, the first two segments are smaller to reduce initial buffering time. |
| `format`            | `AudioFormat` | auto-detect | Optional format override ('mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav'). Auto-detected from file if not specified. |

### API Surface

- `createM3U8(): Promise<string>` – Returns a full playlist with frame-accurate durations.
- `getFileBuffer(start: number, end: number): Promise<Buffer>` – Streams a byte range from the audio file.
- `getSegmentDuration(index: number): Promise<number>` – Reads the cached segment table to return the duration of a segment in seconds.

Custom error classes are exported to help with error handling: `FileNotFoundError`, `InvalidFileError`, `InvalidRangeError`, `InvalidParameterError`, and `UnsupportedFormatError`.

### Supported Formats

| Format | Extensions | Container | Codec | Frame Parsing |
|--------|-----------|-----------|-------|---------------|
| **MP3** | `.mp3` | — | MPEG-1/2 Layer III | ✅ Full frame table |
| **AAC** | `.aac` | ADTS | AAC | ✅ ADTS frames |
| **M4A** | `.m4a`, `.m4b` | MP4 | AAC | ✅ MP4 box structure |
| **OGG** | `.ogg`, `.oga` | OGG | Vorbis | ✅ OGG pages |
| **FLAC** | `.flac` | — | FLAC | ✅ FLAC frames |
| **WAV** | `.wav` | RIFF | PCM | ⚠️ Synthetic 1-second frames |

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

- **Caching** – Construct the streamer once per unique audio file and reuse it. Segment planning caches the metadata, so repeated calls to `createM3U8()` or `getSegmentDuration()` are cheap.
- **CDN friendliness** – Because segment URLs are deterministic byte ranges, edge caches can serve them efficiently. Configure consistent caching headers (e.g. `Cache-Control: public, max-age=86400`).
- **Serverless** – The zero-dependency design works well in Lambda/Cloud Functions. For large files, prefer streaming reads (`getFileBuffer`) instead of loading entire files into memory.
- **Monitoring** – Log segment `start`/`end` pairs and durations to correlate playback issues with specific byte ranges or frame parsing warnings.
- **Troubleshooting** – For corrupted files, inspect `FileLib.analyzeAudioFile()` to review parsing warnings and format-specific metadata.
- **Format selection** – All formats work seamlessly with HLS, but consider:
  - **MP3/AAC/M4A**: Best compatibility with HLS players
  - **FLAC**: Lossless quality but larger segments
  - **OGG**: Open-source, good compression
  - **WAV**: Uncompressed, very large segments (consider smaller `segmentSizeKB`)

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

## Release Notes

### Version 3.1.0

This release focuses on HLS compliance and format-detection reliability.

#### Fixes
- **HLS playlist compliance**: `#EXTINF` lines now include the required trailing comma.
- **AAC ADTS detection**: ADTS buffers are no longer misclassified as MP3 by broad sync checks.
- **Parser routing**: MP3 parser detection now validates MPEG version/layer bits to avoid false positives on AAC-like headers.
- **Extensionless files**: constructor validation now accepts extensionless (or mislabeled) files when magic bytes identify a supported audio format.

#### Quality improvements
- Added regression tests for:
  - `#EXTINF` comma compliance
  - AAC-vs-MP3 sync ambiguity
  - extensionless supported file handling

---

## Version 3.0.0 Breaking Changes

This major release adds multi-format support with pure TypeScript parsers. While most code remains backward compatible, please note:

### What Changed
- **New formats**: Added AAC, M4A, OGG Vorbis, FLAC, and WAV support
- **Format detection**: Files are now validated against all supported formats, not just MP3
- **Error types**: `InvalidFileError` for non-MP3 files is now `UnsupportedFormatError` for unsupported formats
- **Internal architecture**: MP3 parsing refactored into modular `Parsers/` directory

### Migration Guide
```typescript
// v2.x - Only MP3 supported
const streamer = new HlsStreamer({ filePath: 'song.mp3' });

// v3.x - All formats work the same way!
const streamer = new HlsStreamer({ filePath: 'song.mp3' }); // ✅ Still works
const streamer = new HlsStreamer({ filePath: 'song.ogg' }); // ✅ Now supported
const streamer = new HlsStreamer({ filePath: 'song.flac' }); // ✅ Now supported

// Error handling update
try {
  new HlsStreamer({ filePath: 'document.pdf' });
} catch (err) {
  // v2.x: InvalidFileError
  // v3.x: UnsupportedFormatError
}
```

### Deprecated APIs
- `Mp3FileInfo` → Use `AudioFileInfo` (backward compatible, but deprecated)
- `Mp3FrameInfo` → Use `AudioFrameInfo` (backward compatible, but deprecated)
- `FileLib.analyzeMP3File()` → Use `FileLib.analyzeAudioFile()` (old method still works)

All deprecated APIs remain functional for backward compatibility but will be removed in v4.0.0.

---

Made with ❤️ by [LordVersA](https://github.com/LordVersA)
