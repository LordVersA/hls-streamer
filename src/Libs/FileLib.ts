/**
 * File utility functions
 */
export class FileLib {
  /**
   * Get buffer size in bytes
   */
  static getFileSizeInBytes(buffer: Buffer): number {
    if (Buffer.isBuffer(buffer)) {
      return buffer.length;
    } else {
      throw new Error("Input is not a buffer");
    }
  }

  /**
   * Extract MP3 duration from buffer data (zero dependency implementation)
   */
  static getMP3DurationFromBuffer(mp3Buffer: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        const duration = this.parseMP3Duration(mp3Buffer);
        resolve(duration);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Parse MP3 duration by reading frame headers
   */
  private static parseMP3Duration(buffer: Buffer): number {
    // Handle empty buffers
    if (buffer.length === 0) {
      return 0;
    }

    const bitrates = [
      [0, 0, 0, 0, 0],
      [32, 32, 32, 32, 8],
      [64, 48, 40, 48, 16],
      [96, 56, 48, 56, 24],
      [128, 64, 56, 64, 32],
      [160, 80, 64, 80, 40],
      [192, 96, 80, 96, 48],
      [224, 112, 96, 112, 56],
      [256, 128, 112, 128, 64],
      [288, 160, 128, 144, 80],
      [320, 192, 160, 160, 96],
      [352, 224, 192, 176, 112],
      [384, 256, 224, 192, 128],
      [416, 320, 256, 224, 144],
      [448, 384, 320, 256, 160]
    ];

    const sampleRates = [
      [44100, 22050, 11025],
      [48000, 24000, 12000],
      [32000, 16000, 8000]
    ];

    let offset = 0;
    let totalFrames = 0;
    let sampleRate = 0;
    let samplesPerFrame = 0;

    // Skip ID3v2 tag if present
    if (buffer.length > 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
      const tagSize = ((buffer[6]! & 0x7f) << 21) |
                     ((buffer[7]! & 0x7f) << 14) |
                     ((buffer[8]! & 0x7f) << 7) |
                     (buffer[9]! & 0x7f);
      offset = 10 + tagSize;
    }

    while (offset < buffer.length - 3) {
      // Look for MP3 frame sync (11 bits set)
      if ((buffer[offset]! === 0xFF) && ((buffer[offset + 1]! & 0xE0) === 0xE0)) {
        if (offset + 3 >= buffer.length) break;

        const header = (buffer[offset]! << 24) |
                      (buffer[offset + 1]! << 16) |
                      (buffer[offset + 2]! << 8) |
                      buffer[offset + 3]!;

        // Extract header fields
        const version = (header >> 19) & 0x3;
        const layer = (header >> 17) & 0x3;
        const bitrateIndex = (header >> 12) & 0xF;
        const sampleRateIndex = (header >> 10) & 0x3;
        const padding = (header >> 9) & 0x1;

        // Validate header
        if (version === 1 || layer === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
          offset++;
          continue;
        }

        // Get bitrate and sample rate
        const versionIndex = version === 3 ? 0 : (version === 2 ? 1 : 2);
        const layerIndex = layer === 3 ? 0 : (layer === 2 ? 1 : 2);

        const bitrate = bitrates[bitrateIndex]?.[versionIndex === 0 ? layerIndex : (layerIndex === 0 ? 3 : 4)];
        const foundSampleRate = sampleRates[sampleRateIndex]?.[versionIndex];

        if (!bitrate || !foundSampleRate) {
          offset++;
          continue;
        }

        // Set sample rate and samples per frame on first valid frame
        if (totalFrames === 0) {
          sampleRate = foundSampleRate;

          // Calculate samples per frame
          if (layer === 3) { // Layer I
            samplesPerFrame = 384;
          } else if (layer === 2) { // Layer II
            samplesPerFrame = 1152;
          } else { // Layer III
            samplesPerFrame = version === 3 ? 1152 : 576;
          }
        }

        // Calculate frame length
        let frameLength;
        if (layer === 3) { // Layer I
          frameLength = Math.floor((12 * bitrate * 1000 / foundSampleRate + padding) * 4);
        } else { // Layer II & III
          frameLength = Math.floor(144 * bitrate * 1000 / foundSampleRate + padding);
        }

        if (frameLength <= 0) {
          offset++;
          continue;
        }

        totalFrames++;

        // If we would go beyond buffer, estimate remaining frames
        if (offset + frameLength > buffer.length) {
          const remainingBytes = buffer.length - offset;
          const avgFrameLength = offset > 0 ? offset / totalFrames : frameLength;
          const estimatedRemainingFrames = Math.floor(remainingBytes / avgFrameLength);
          totalFrames += estimatedRemainingFrames;
          break;
        }

        offset += frameLength;
      } else {
        offset++;
      }
    }

    if (totalFrames === 0 || !sampleRate || !samplesPerFrame) {
      // Fallback: estimate duration based on typical MP3 bitrate (128kbps)
      const estimatedDuration = buffer.length / 16000; // ~128kbps = 16000 bytes/sec
      return Math.max(0.001, estimatedDuration); // Minimum 1ms
    }

    // Calculate duration in seconds
    const duration = (totalFrames * samplesPerFrame) / sampleRate;
    return Math.max(0.001, duration); // Minimum 1ms
  }
}
