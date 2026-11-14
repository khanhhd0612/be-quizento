export const ALLOWED_AUDIO_EXTENSIONS = ['.mp3'];
export const ALLOWED_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/x-mp3'];

import { HttpStatus } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

export const DEFAULT_MAX_AUDIO_SIZE = 5 * 1024 * 1024; // 5 MB mặc định

export const audioFileFilter = (
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file) {
    return callback(new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST), false);
  }

  const isMimeTypeValid = ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype.toLowerCase());
  const hasValidExtension = ALLOWED_AUDIO_EXTENSIONS.some((ext) =>
    file.originalname.toLowerCase().endsWith(ext),
  );

  if (!isMimeTypeValid || !hasValidExtension) {
    return callback(
      new BusinessException(ErrorCode.INVALID_FILE_TYPE, HttpStatus.BAD_REQUEST),
      false,
    );
  }

  callback(null, true);
};

export const createMulterAudioOptions = (
  maxSizeInBytes: number = DEFAULT_MAX_AUDIO_SIZE,
): MulterOptions => ({
  storage: memoryStorage(),
  limits: {
    fileSize: maxSizeInBytes,
  },
  fileFilter: audioFileFilter,
});

export const multerAudioOptions = createMulterAudioOptions();

/**
 * Ước lượng thời lượng file MP3 (tính bằng giây) từ Buffer nhị phân
 */
export function estimateMp3Duration(buffer: Buffer): number | null {
  if (!buffer || buffer.length < 4) return null;

  let offset = 0;

  // Bỏ qua ID3v2 tag nếu có
  if (
    buffer.length > 10 &&
    buffer[0] === 0x49 && // 'I'
    buffer[1] === 0x44 && // 'D'
    buffer[2] === 0x33 // '3'
  ) {
    const id3Size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    offset = 10 + id3Size;
  }

  while (offset + 4 < buffer.length) {
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) {
      const headerByte1 = buffer[offset + 1];
      const headerByte2 = buffer[offset + 2];

      const versionBits = (headerByte1 >> 3) & 0x03;
      const layerBits = (headerByte1 >> 1) & 0x03;
      const bitrateIndex = (headerByte2 >> 4) & 0x0f;

      const mpeg1Layer3Bitrates = [
        0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
      ];
      const mpeg2Layer3Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

      let bitrateKbps = 128;
      if (layerBits === 1) {
        if (versionBits === 3) {
          bitrateKbps = mpeg1Layer3Bitrates[bitrateIndex] || 128;
        } else {
          bitrateKbps = mpeg2Layer3Bitrates[bitrateIndex] || 64;
        }
      }

      if (bitrateKbps > 0) {
        const audioBytes = buffer.length - offset;
        const bytesPerSecond = (bitrateKbps * 1000) / 8;
        return audioBytes / bytesPerSecond;
      }
      break;
    }
    offset++;
  }

  return null;
}
