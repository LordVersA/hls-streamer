# Changelog

## [4.5.1] - 2026-04-29

### Fixed

- **Mp4Parser / AacParser (M4A):** Corrected byte offsets when reading `mvhd` and `mdhd` boxes. Parser was reading `modification_time` instead of `timescale`, causing incorrect duration and timescale values for all MP4 and M4A files.
- **AacParser (M4A):** Replaced synthetic uniform-size frame generation with real sample table parsing. M4A is now delegated to `Mp4Parser` which reads the actual `stsz` sample size table, eliminating potential audio corruption at segment boundaries.

### Performance

- **Mp3Parser:** Replaced byte-by-byte scan for MPEG sync markers with `Buffer.indexOf(0xFF)`. Significantly reduces parse time for files with large ID3 tags (e.g. embedded album art).

---

## [4.5.0] - 2026-04-23

- Add S3 streaming support
