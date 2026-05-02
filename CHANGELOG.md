# Changelog

## [4.6.0] - 2026-05-02

### Added

- **`HlsStreamer.getFileInfo()`** is now public, returning the parsed `MediaFileInfo` (size, duration, frame table, etc.). Result is cached on the instance.
- **`HlsStreamer.restoreFileInfo(fileInfo)`** lets consumers hydrate a previously-parsed `MediaFileInfo` into a fresh instance, skipping the underlying parse entirely. Intended for use behind an external metadata cache (LRU, Redis, etc.) so short-lived `HlsStreamer` instances can avoid redundant downloads and re-parsing of the same file. Pairs with `JSON.stringify` / `JSON.parse` for cross-process persistence.

### Performance

- **`getMediaType()`** no longer triggers a full file read in the common path. It now reads only the file header (~64 bytes) via `provider.getHeader()` and classifies via magic bytes; falls back to a full parse only when the header is inconclusive. When a `format` option was supplied at construction, classification happens with no read at all.
- **`getFileBuffer()`** no longer triggers a full file parse. It validates the requested range using only `provider.getSize()` (a HEAD-equivalent for remote providers), then issues the ranged read. The size is memoized on the instance, so repeated segment requests against the same `HlsStreamer` instance issue exactly one `getSize()` call regardless of how many ranges are fetched.

### Notes

- Fully backward compatible: no existing method signatures or behaviors changed; all changes are additive (`getFileInfo` was promoted from `private` to `public`).
- Parser internals (`Mp3Parser`, `AacParser`, `Mp4Parser`, etc.) are unchanged — segmentation correctness is preserved.
- Test suite expanded from 264 → 280 tests covering the new lazy paths, size caching, and `restoreFileInfo` round-trip behavior.

---

## [4.5.1] - 2026-04-29

### Fixed

- **Mp4Parser / AacParser (M4A):** Corrected byte offsets when reading `mvhd` and `mdhd` boxes. Parser was reading `modification_time` instead of `timescale`, causing incorrect duration and timescale values for all MP4 and M4A files.
- **AacParser (M4A):** Replaced synthetic uniform-size frame generation with real sample table parsing. M4A is now delegated to `Mp4Parser` which reads the actual `stsz` sample size table, eliminating potential audio corruption at segment boundaries.

### Performance

- **Mp3Parser:** Replaced byte-by-byte scan for MPEG sync markers with `Buffer.indexOf(0xFF)`. Significantly reduces parse time for files with large ID3 tags (e.g. embedded album art).

---

## [4.5.0] - 2026-04-23

- Add S3 streaming support
