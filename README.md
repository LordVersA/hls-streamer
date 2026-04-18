![HLS Streamer](https://raw.githubusercontent.com/LordVersA/hls-streamer/main/assets/header.png)

# HLS Streamer

[![npm version](https://badge.fury.io/js/hls-streamer.svg)](https://badge.fury.io/js/hls-streamer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

HLS Streamer converts audio and video files (MP3, AAC, M4A, OGG Vorbis, FLAC, WAV, MP4, MOV, M4V) into HTTP Live Streaming (HLS) playlists on the fly. It analyses the source file in-memory, builds frame-aligned byte ranges, and streams them without temporary files, native bindings, or external binaries like ffmpeg.

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

- **Multi-format support** – handles MP3, AAC, M4A, OGG Vorbis, FLAC, WAV, MP4, MOV, and M4V with automatic format detection.
- **Audio + Video** – audio files produce standard HLS v6 playlists; video files produce HLS v7 fMP4 playlists with an `EXT-X-MAP` init segment and keyframe-aligned boundaries.
- **Zero dependencies** – no shared libraries, no ffmpeg, no native compilation. Pure TypeScript parsers for all formats. Drop it into Docker, serverless, or edge runtimes.
- **Accurate segments** – real frame/packet parsing provides true durations, `#EXTINF` metadata, and target durations that match playback.
- **Frame-aligned byte ranges** – every segment begins and ends on verified frame boundaries; video segments snap to keyframes to prevent decoding artifacts.
- **No temp files** – streams straight from the source file using byte-range reads.
- **Fast-start aware** – optional smaller first segments improve startup latency for constrained networks.
- **TypeScript first** – authored in TypeScript with full type definitions for your tooling and IDEs.

## How It Works

1. **Format detection** – automatically detects format from file content (magic bytes / `ftyp` brand) or extension, with optional manual override.
2. **Metadata analysis** – format-specific parsers extract frame/packet tables with offsets, durations, and (for video) keyframe markers.
3. **Segment planning** – boundaries are calculated from the frame table so each segment contains whole frames while respecting your target size. Video segments snap to I-frame boundaries.
4. **Playlist generation** – `createM3U8()` emits an `#EXTM3U` playlist. Audio files use HLS v6; video files use HLS v7 with `EXT-X-MAP` pointing to the `moov` init segment.
5. **On-demand byte ranges** – `getFileBuffer(start, end)` reads only the bytes needed for a given segment or init segment.

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│ Media Source │ ──▶ │ Format Detector │ ──▶ │ Format Parser   │ ──▶ │ Segment Planner      │
│ (any format) │     │ (magic bytes)   │     │ (MP3/MP4/etc.)  │     │ (frame/keyframe)     │
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

// Audio file — auto-detected
const audioStreamer = new HlsStreamer({
  filePath: '/media/library/song.mp3', // or .aac, .m4a, .ogg, .flac, .wav
  segmentSizeKB: 512,
  fileName: 'track',
  baseUrl: 'audio/stream/session-42',
  enableFastStart: true,
});

const audioPlaylist = await audioStreamer.createM3U8();

// Video file — same API
const videoStreamer = new HlsStreamer({
  filePath: '/media/library/movie.mp4', // or .mov, .m4v
  segmentSizeKB: 2048,
  fileName: 'segment',
  baseUrl: 'video/stream/session-42',
});

const videoPlaylist = await videoStreamer.createM3U8();

// Detect media type at runtime
const type = await videoStreamer.getMediaType(); // 'video' | 'audio'
```

## Serving Over HTTP

The example below shows an Express setup that handles both audio and video:

```ts
import express from 'express';
import { HlsStreamer } from 'hls-streamer';

const app = express();

app.get('/streams/:id/playlist.m3u8', async (req, res, next) => {
  try {
    const streamer = new HlsStreamer({
      filePath: resolveMediaPath(req.params.id),
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
      filePath: resolveMediaPath(req.params.id),
      baseUrl: `streams/${req.params.id}`,
    });

    const start = Number(req.params.start);
    const end = Number(req.params.end);
    const mediaType = await streamer.getMediaType();

    res.type(mediaType === 'video' ? 'video/mp4' : 'audio/mpeg');
    res.set('Accept-Ranges', 'bytes');
    res.send(await streamer.getFileBuffer(start, end));
  } catch (error) {
    next(error);
  }
});
```

### Segment URL Contract

Generated playlists follow this pattern:

```
/{baseUrl}/{startByte}/{endByte}/{fileName}{index}.{ext}
```

For video files, an additional init segment URL is emitted as `EXT-X-MAP`:

```
/{baseUrl}/{moovOffset}/{moovEnd}/{fileName}init.mp4
```

- `startByte` is inclusive, `endByte` is exclusive.
- `index` is zero-padded to three digits (`000`, `001`, ...).
- Serve the exact byte range from the original file — no transcoding needed.

## Configuration Reference

| Option            | Type          | Default      | Description |
| ----------------- | ------------- | ------------ | ----------- |
| `filePath`        | `string`      | —            | Path to the media file. Supports: MP3, AAC, M4A, OGG, FLAC, WAV, MP4, MOV, M4V. |
| `segmentSizeKB`   | `number`      | `512`        | Target segment size in kilobytes. |
| `fileName`        | `string`      | `"file"`     | Base name for generated segment URLs. |
| `baseUrl`         | `string`      | `""`         | URL prefix inserted before each segment path. |
| `enableFastStart` | `boolean`     | `false`      | Smaller first two segments for faster playback start. |
| `format`          | `MediaFormat` | auto-detect  | Optional override: `'mp3'`, `'aac'`, `'m4a'`, `'ogg'`, `'flac'`, `'wav'`, `'mp4'`, `'mov'`, `'m4v'`. |

### API Surface

- `createM3U8(): Promise<string>` – Full HLS playlist with frame-accurate durations. Audio → HLS v6; Video → HLS v7 + `EXT-X-MAP`.
- `getFileBuffer(start: number, end: number): Promise<Buffer>` – Byte-range read from the source file (used for both segments and the init segment).
- `getSegmentDuration(index: number): Promise<number>` – Duration in seconds for a specific segment.
- `getMediaType(): Promise<'audio' | 'video'>` – Returns `'video'` for MP4/MOV/M4V, `'audio'` for everything else.

Custom error classes: `FileNotFoundError`, `InvalidFileError`, `InvalidRangeError`, `InvalidParameterError`, `UnsupportedFormatError`.

### Supported Formats

| Format  | Extensions          | Container | Codec        | Frame Parsing                   |
| ------- | ------------------- | --------- | ------------ | ------------------------------- |
| **MP3** | `.mp3`              | —         | MPEG Layer 3 | ✅ Full frame table              |
| **AAC** | `.aac`              | ADTS      | AAC          | ✅ ADTS frames                   |
| **M4A** | `.m4a`, `.m4b`      | MP4       | AAC          | ✅ MP4 box structure             |
| **OGG** | `.ogg`, `.oga`      | OGG       | Vorbis       | ✅ OGG pages                     |
| **FLAC**| `.flac`             | —         | FLAC         | ✅ FLAC frames                   |
| **WAV** | `.wav`              | RIFF      | PCM          | ⚠️ Synthetic 1-second frames    |
| **MP4** | `.mp4`              | fMP4      | H.264/H.265  | ✅ ISOBMFF box parse + keyframes |
| **MOV** | `.mov`              | QuickTime | H.264/H.265  | ✅ ISOBMFF box parse + keyframes |
| **M4V** | `.m4v`              | MP4       | H.264/H.265  | ✅ ISOBMFF box parse + keyframes |

## Playlist Anatomy

### Audio (HLS v6)

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

### Video (HLS v7 fMP4)

```m3u8
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-MAP:URI="/video/session/0/28672/fileinit.mp4"
#EXTINF:4.000,
/video/session/28672/2125824/file000.mp4
#EXTINF:3.967,
/video/session/2125824/4194304/file001.mp4
...
#EXT-X-ENDLIST
```

- `EXT-X-MAP` points to the `moov` box (init segment) inside the original file — no remuxing.
- Video segment boundaries are snapped to keyframes for seamless decoding.
- `#EXTINF` retains millisecond precision for smooth playback.

## Operational Tips

- **Caching** – Construct the streamer once per unique file and reuse it. Segment planning caches metadata after the first call.
- **Video segment size** – Use a larger `segmentSizeKB` (1024–4096) for video to avoid excessive HTTP requests. Audio works well at 512.
- **CDN friendliness** – Segment URLs are deterministic byte ranges, making them ideal for edge caching. Use `Cache-Control: public, max-age=86400`.
- **Serverless** – Zero-dependency design works in Lambda/Cloud Functions. `getFileBuffer` reads only the bytes needed, keeping memory usage low.
- **Content-Type** – Serve audio segments as `audio/mpeg` (or the appropriate codec MIME type) and video segments as `video/mp4`. Use `getMediaType()` to branch at runtime.
- **Troubleshooting** – Inspect `FileLib.analyzeMediaFile()` to review parsing warnings and format-specific metadata.

## Development

```bash
npm install
npm test
npm run build
```

To run a single test file:

```bash
npx jest tests/Parsers/Mp4Parser.test.ts
```

## Support

- 🐛 Bug reports: [GitHub Issues](https://github.com/LordVersA/hls-streamer/issues)
- 💬 Questions & ideas: [GitHub Discussions](https://github.com/LordVersA/hls-streamer/discussions)
- 📦 npm registry: [hls-streamer](https://www.npmjs.com/package/hls-streamer)

## Contributing

Contributions are welcome! Please open an issue to discuss substantial changes before submitting a pull request. Make sure `npm test` and `npm run build` pass prior to filing the PR.

---

## Release Notes

### Version 4.0.0

Major release adding video support and completing the audio→media rename.

#### New Features
- **Video support** – MP4, MOV, and M4V files are now fully supported via a pure-JS ISOBMFF (MP4 box) parser. No ffmpeg, no native bindings, no vendored libraries.
- **HLS v7 fMP4 playlists** – video files produce `EXT-X-MAP` init segments and keyframe-aligned byte-range segments, fully compatible with Safari, Chrome, and HLS.js.
- **Keyframe-aware segmentation** – video segment boundaries snap to I-frames, preventing decoding artifacts.
- **`getMediaType()`** – new method returning `'audio' | 'video'` to simplify route/MIME-type logic.
- **`MediaFormat` / `MediaFileInfo` / `MediaFrameInfo`** – public types renamed from `Audio*` to `Media*` to reflect the broader scope.

#### Breaking Changes (from v3)
- `AudioFormat`, `AudioFileInfo`, `AudioFrameInfo`, `IAudioParser` are now **deprecated** aliases — they still compile but will be removed in v5.
- `FileLib.analyzeAudioFile()` and `analyzeAudioBuffer()` are deprecated; use `analyzeMediaFile()` / `analyzeMediaBuffer()`.
- `UnsupportedFormatError` message changed from `"Unsupported audio format"` to `"Unsupported media format"`.
- `format` option type widened from `AudioFormat` to `MediaFormat` (superset — no change needed for existing callers).

#### Migration Guide

```typescript
// v3.x
import { AudioFormat, AudioFileInfo } from 'hls-streamer';
const type: AudioFormat = 'mp3';

// v4.x — preferred
import { MediaFormat, MediaFileInfo } from 'hls-streamer';
const type: MediaFormat = 'mp3'; // same values, broader type

// v3.x names still compile in v4 (deprecated, removed in v5)
import { AudioFormat } from 'hls-streamer'; // ⚠️ deprecated alias

// Video — new in v4
const streamer = new HlsStreamer({ filePath: 'movie.mp4' });
const playlist = await streamer.createM3U8(); // HLS v7 + EXT-X-MAP
const type = await streamer.getMediaType();   // 'video'
```

---

### Version 3.1.0

- **HLS compliance**: `#EXTINF` lines now include the required trailing comma.
- **AAC ADTS detection**: ADTS buffers no longer misclassified as MP3.
- **Extensionless files**: constructor now accepts extensionless files when magic bytes identify a supported format.

---

### Version 3.0.0

- Added AAC, M4A, OGG Vorbis, FLAC, and WAV support.
- Refactored MP3 parsing into a modular `Parsers/` directory.
- `InvalidFileError` for non-MP3 files replaced by `UnsupportedFormatError`.

---

Made with ❤️ by [LordVersA](https://github.com/LordVersA)
