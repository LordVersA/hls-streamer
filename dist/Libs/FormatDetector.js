export class FormatDetector {
    static detectFormat(buffer) {
        if (buffer.length < 4) {
            return null;
        }
        if (buffer.toString('ascii', 0, 3) === 'ID3') {
            return 'mp3';
        }
        if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
            return 'mp3';
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
            if (brand === 'M4A ' || brand === 'M4B ' || brand === 'mp42' || brand === 'isom') {
                return 'm4a';
            }
        }
        if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) {
            return 'aac';
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
            default:
                return null;
        }
    }
    static getSupportedExtensions() {
        return ['.mp3', '.aac', '.m4a', '.m4b', '.ogg', '.oga', '.flac', '.wav'];
    }
    static isSupportedExtension(filePath) {
        const ext = '.' + filePath.toLowerCase().split('.').pop();
        return this.getSupportedExtensions().includes(ext);
    }
}
//# sourceMappingURL=FormatDetector.js.map