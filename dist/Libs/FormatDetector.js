export class FormatDetector {
    static detectFormat(buffer) {
        if (buffer.length < 4) {
            return null;
        }
        if (buffer.toString('ascii', 0, 3) === 'ID3') {
            return 'mp3';
        }
        if (buffer.length >= 2 && buffer[0] === 0xff) {
            const secondByte = buffer[1];
            if ((secondByte & 0xf6) === 0xf0) {
                return 'aac';
            }
            if ((secondByte & 0xe0) === 0xe0) {
                const versionBits = (secondByte >> 3) & 0x3;
                const layerBits = (secondByte >> 1) & 0x3;
                if (versionBits !== 0x1 && layerBits !== 0x0) {
                    return 'mp3';
                }
            }
        }
        if (buffer.toString('ascii', 0, 4) === 'fLaC') {
            return 'flac';
        }
        if (buffer.toString('ascii', 0, 4) === 'OggS') {
            return 'ogg';
        }
        if (buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WAVE') {
            return 'wav';
        }
        if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
            const brand = buffer.toString('ascii', 8, 12);
            if (brand === 'M4A ' || brand === 'M4B ') {
                return 'm4a';
            }
            if (brand === 'qt  ') {
                return 'mov';
            }
            if (brand.startsWith('M4V')) {
                return 'm4v';
            }
            if (brand === 'mp42' || brand === 'isom' || brand === 'mp41' ||
                brand === 'avc1' || brand === 'iso2' || brand === 'iso5' || brand === 'iso6') {
                return 'mp4';
            }
            return 'mp4';
        }
        return null;
    }
    static detectFormatFromExtension(filePath) {
        const ext = filePath.toLowerCase().split('.').pop();
        switch (ext) {
            case 'mp3':
                return 'mp3';
            case 'aac':
                return 'aac';
            case 'm4a':
            case 'm4b':
                return 'm4a';
            case 'ogg':
            case 'oga':
                return 'ogg';
            case 'flac':
                return 'flac';
            case 'wav':
                return 'wav';
            case 'mp4':
                return 'mp4';
            case 'mov':
                return 'mov';
            case 'm4v':
                return 'm4v';
            default:
                return null;
        }
    }
    static getSupportedExtensions() {
        return ['.mp3', '.aac', '.m4a', '.m4b', '.ogg', '.oga', '.flac', '.wav', '.mp4', '.mov', '.m4v'];
    }
    static isSupportedExtension(filePath) {
        const ext = '.' + filePath.toLowerCase().split('.').pop();
        return this.getSupportedExtensions().includes(ext);
    }
}
//# sourceMappingURL=FormatDetector.js.map