import path from 'path';

export interface FileScanResult {
  isSafe: boolean;
  fileType: 'pdf' | 'docx' | 'doc' | 'image' | 'unknown';
  sanitizedFileName: string;
  reasons: string[];
}

export class CVSecurityScanner {
  private static readonly MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB Max
  private static readonly ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg'
  ]);
  private static readonly DANGEROUS_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.vbs', '.js', '.wsf', '.msi', '.ps1', '.sh', '.py', '.scr', '.dll', '.com', '.pif'
  ]);

  /**
   * Scans an in-memory buffer before parsing or saving
   */
  static scanBuffer(fileName: string, buffer: Buffer): FileScanResult {
    const reasons: string[] = [];
    const ext = path.extname(fileName).toLowerCase();

    // 1. File Size Verification
    if (buffer.length > this.MAX_FILE_SIZE_BYTES) {
      return {
        isSafe: false,
        fileType: 'unknown',
        sanitizedFileName: this.sanitizeFileName(fileName),
        reasons: [`File size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds 15MB limit`],
      };
    }

    if (buffer.length === 0) {
      return {
        isSafe: false,
        fileType: 'unknown',
        sanitizedFileName: this.sanitizeFileName(fileName),
        reasons: ['File buffer is empty (0 bytes)'],
      };
    }

    // 2. Dangerous Extension Check
    if (this.DANGEROUS_EXTENSIONS.has(ext)) {
      return {
        isSafe: false,
        fileType: 'unknown',
        sanitizedFileName: this.sanitizeFileName(fileName),
        reasons: [`Executable extension ${ext} is blocked for security`],
      };
    }

    if (!this.ALLOWED_EXTENSIONS.has(ext)) {
      return {
        isSafe: false,
        fileType: 'unknown',
        sanitizedFileName: this.sanitizeFileName(fileName),
        reasons: [`Extension ${ext} is not an accepted document or image format`],
      };
    }

    // 3. Executable Header Check at Byte 0 (DOS/Windows PE MZ header: 0x4D 0x5A)
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return {
        isSafe: false,
        fileType: 'unknown',
        sanitizedFileName: this.sanitizeFileName(fileName),
        reasons: ['Executable DOS/PE (MZ) binary header detected at file start'],
      };
    }

    // ELF executable signature (0x7F 'E' 'L' 'F')
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      return {
        isSafe: false,
        fileType: 'unknown',
        sanitizedFileName: this.sanitizeFileName(fileName),
        reasons: ['Executable ELF binary header detected at file start'],
      };
    }

    // 4. Genuine Magic Byte Signature Verification
    let detectedType: 'pdf' | 'docx' | 'doc' | 'image' | 'unknown' = 'unknown';

    // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      detectedType = 'pdf';
    }
    // DOCX (ZIP container) Magic Bytes: PK\x03\x04
    else if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      detectedType = 'docx';
    }
    // Legacy DOC: 0xD0 0xCF 0x11 0xE0
    else if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      detectedType = 'doc';
    }
    // JPEG Magic Bytes: 0xFF 0xD8 0xFF
    else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      detectedType = 'image';
    }
    // PNG Magic Bytes: 0x89 0x50 0x4E 0x47
    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      detectedType = 'image';
    } else {
      // If extension is docx/doc but magic bytes differ slightly, accept if not executable
      if (ext === '.docx' || ext === '.doc') {
        detectedType = 'docx';
      } else {
        return {
          isSafe: false,
          fileType: 'unknown',
          sanitizedFileName: this.sanitizeFileName(fileName),
          reasons: ['File signature does not match recognized document or image headers'],
        };
      }
    }

    return {
      isSafe: true,
      fileType: detectedType,
      sanitizedFileName: this.sanitizeFileName(fileName),
      reasons: [],
    };
  }

  /**
   * Sanitizes file names to prevent directory traversal and null-byte injection
   */
  static sanitizeFileName(name: string): string {
    return name
      .replace(/[\0\r\n\t]/g, '')
      .replace(/(\.\.[\/\\])+/g, '')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .slice(0, 100);
  }
}
