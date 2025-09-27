# HLS Streamer

[![npm version](https://badge.fury.io/js/hls-streamer.svg)](https://badge.fury.io/js/hls-streamer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

**HLS Streamer** is a lightweight npm package that creates and streams HLS (HTTP Live Streaming) from MP3 files on demand, without storing temporary files or requiring ffmpeg.

## ✨ Features

- 🚀 **True Zero Dependencies** - No external dependencies, no ffmpeg, no native binaries
- 🎵 **Built-in MP3 Parser** - Custom MP3 duration parsing without external libraries
- 🔄 **Frame-Aligned Segments** - Ensures all MP3 segments start at valid frame boundaries for seamless playback
- 💾 **No Temporary Files** - Stream directly from source
- ⚡ **Fast Startup** - Optional smaller initial segments for quick playback start
- 🎯 **TypeScript Support** - Full type definitions included
- 🔧 **Configurable** - Customizable segment sizes and naming
- 📱 **Memory Efficient** - Byte-range streaming with minimal memory footprint

## 📦 Installation

```bash
npm install hls-streamer
```

```bash
yarn add hls-streamer
```

```bash
pnpm add hls-streamer
```

## 🎯 Zero Dependencies

This package is **truly zero-dependency**, meaning:

- ✅ **No ffmpeg** - No external binary dependencies
- ✅ **No native modules** - Pure JavaScript/TypeScript implementation
- ✅ **No runtime dependencies** - Check `package.json` - completely empty dependencies
- ✅ **Custom MP3 parser** - Built-in MP3 header parsing and duration calculation
- ✅ **Frame-perfect segmentation** - MP3 segments start at valid frame boundaries
- ✅ **Cross-platform** - Works on any platform that supports Node.js

Perfect for:
- 🐳 **Docker containers** - No need to install ffmpeg
- 🌐 **Serverless functions** - Minimal package size and cold start time
- 📱 **Edge computing** - Lightweight deployment
- 🔒 **Security-conscious environments** - No external binaries to audit

## 🚀 Quick Start

### Basic Usage

```typescript
import { HlsStreamer } from 'hls-streamer';

const hls = new HlsStreamer({
  filePath: 'path/to/audio.mp3',
  segmentSizeKB: 512,
  fileName: 'segment',
  baseUrl: 'segments/session-123',
  enableFastStart: true
});

// Generate M3U8 playlist
const playlist = await hls.createM3U8();

// Get file buffer for specific byte range
const buffer = await hls.getFileBuffer(startByte, endByte);
```

### Express.js Integration

```typescript
import express from 'express';
import { HlsStreamer } from 'hls-streamer';

const app = express();

// Serve M3U8 playlist
app.get('/stream/:sessionId/playlist.m3u8', async (req, res) => {
  const hls = new HlsStreamer({
    filePath: getFilePath(req.params.sessionId),
    baseUrl: `stream/${req.params.sessionId}`,
    enableFastStart: true
  });

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.send(await hls.createM3U8());
});

// Serve segment files
app.get('/stream/:sessionId/:start/:end/:filename', async (req, res) => {
  const hls = new HlsStreamer({
    filePath: getFilePath(req.params.sessionId),
    baseUrl: `stream/${req.params.sessionId}`
  });

  const start = parseInt(req.params.start);
  const end = parseInt(req.params.end);

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.send(await hls.getFileBuffer(start, end));
});
```

## 🛠️ API Reference

### HlsStreamer

#### Constructor Options

```typescript
interface HlsStreamerOptions {
  /** Path to the MP3 file */
  filePath: string;
  /** Segment size in KB (default: 512) */
  segmentSizeKB?: number;
  /** Base filename for segments (default: "file") */
  fileName?: string;
  /** Base URL path for segment URLs */
  baseUrl?: string;
  /** Enable smaller initial segments for faster startup */
  enableFastStart?: boolean;
}
```

#### Methods

##### `createM3U8(): Promise<string>`
Generates an HLS M3U8 playlist file content.

**Returns:** M3U8 playlist as a string

##### `getFileBuffer(startByte: number, endByte: number): Promise<Buffer>`
Retrieves a specific byte range from the MP3 file.

**Parameters:**
- `startByte` - Starting byte position (inclusive)
- `endByte` - Ending byte position (exclusive)

**Returns:** Buffer containing the requested byte range

##### `getSegmentDuration(segmentIndex: number): Promise<number>`
Gets the accurate duration of a specific segment.

**Parameters:**
- `segmentIndex` - Zero-based segment index

**Returns:** Duration in seconds

### Error Handling

The package includes custom error types for better error handling:

```typescript
import {
  FileNotFoundError,
  InvalidFileError,
  InvalidRangeError,
  InvalidParameterError
} from 'hls-streamer';

try {
  const hls = new HlsStreamer({ filePath: 'nonexistent.mp3' });
} catch (error) {
  if (error instanceof FileNotFoundError) {
    console.error('File not found:', error.message);
  }
}
```

## 📋 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filePath` | `string` | **required** | Path to the MP3 file |
| `segmentSizeKB` | `number` | `512` | Size of each segment in KB |
| `fileName` | `string` | `"file"` | Base name for segment files |
| `baseUrl` | `string` | `""` | Base URL path for segment URLs |
| `enableFastStart` | `boolean` | `false` | Use smaller initial segments for faster startup |

## 🎯 Use Cases

- **Audio Streaming Services** - Stream music without pre-processing
- **Podcast Platforms** - On-demand episode streaming
- **Educational Platforms** - Stream lecture recordings
- **Voice Message Systems** - Real-time audio message playback
- **Audio Books** - Chapter-based streaming

## 🔧 Advanced Examples

### Custom Segment Sizing

```typescript
const hls = new HlsStreamer({
  filePath: 'large-audio-file.mp3',
  segmentSizeKB: 1024, // 1MB segments for better quality
  enableFastStart: true // First segments will be 256KB and 512KB
});
```

### Dynamic File Paths

```typescript
class AudioStreamer {
  async streamAudio(userId: string, audioId: string) {
    const filePath = await this.getAudioPath(userId, audioId);

    const hls = new HlsStreamer({
      filePath,
      baseUrl: `audio/${userId}/${audioId}`,
      fileName: `audio-${audioId}`,
      segmentSizeKB: 256 // Smaller segments for mobile
    });

    return hls.createM3U8();
  }
}
```

## 🧪 Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

## 🏗️ Building

```bash
npm run build        # Build both ESM and CJS
npm run build:esm    # Build ES modules
npm run build:cjs    # Build CommonJS
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/LordVersA/hls-streamer/issues)
- 💬 **Questions:** [GitHub Discussions](https://github.com/LordVersA/hls-streamer/discussions)
- 📦 **NPM:** [hls-streamer](https://www.npmjs.com/package/hls-streamer)

---

Made with ❤️ by [LordVersA](https://github.com/LordVersA)
