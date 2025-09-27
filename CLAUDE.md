# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an npm package that creates and streams HLS (HTTP Live Streaming) from MP3 files on demand without storing temporary files or requiring ffmpeg. The main export is the `HlsStreamer` class that handles MP3 file segmentation and M3U8 playlist generation.

## Build Commands

- `npm run build` - Build both ESM and CommonJS versions (clears dist/ first)
- `npm run build:esm` - Build ESM version using TypeScript compiler
- `npm run build:cjs` - Build CommonJS version to dist/cjs/

## Architecture

### Core Components

- **HlsStreamer** (`src/index.ts`): Main class that handles MP3 file streaming
  - Takes MP3 file path and configuration options
  - Generates M3U8 playlists dynamically
  - Provides byte-range access to file segments
  - Supports variable segment sizes for initial segments

- **HlsStreamerOption** (`src/Interfaces/HlsStreamer.ts`): Configuration interface
  - `filePath`: Path to MP3 file
  - `eachSegmentSize`: Segment size in KB (default 512KB)
  - `fileName`: Base name for segments
  - `basePath`: URL base path for segments
  - `lessSizeForFirst2Segments`: Reduces first 2 segment sizes for faster startup

- **FileLib** (`src/Libs/FileLib.ts`): Utility functions for file operations
  - Buffer size calculation
  - MP3 duration extraction using mp3-duration library

### Key Features

- **On-demand streaming**: No temporary file storage required
- **Byte-range serving**: Uses `getFileBuffer(start, end)` for efficient streaming
- **Variable segment sizing**: First 2 segments can be smaller for faster playback start
- **M3U8 generation**: Creates HLS playlists with proper segment URLs and durations

### TypeScript Configuration

- Target: ES2016
- Module: CommonJS (with dual ESM/CJS build)
- Strict mode enabled
- Output directory: `./dist`
- Source directory: `./src`