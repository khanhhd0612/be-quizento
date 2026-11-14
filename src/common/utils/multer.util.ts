import { HttpStatus } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

/**
 * Danh sách định dạng ảnh hợp lệ
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

export const DEFAULT_MAX_IMAGE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10); // 5 MB mặc định

/**
 * Filter kiểm tra định dạng file ảnh cho Multer
 */
export const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file) {
    return callback(new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST), false);
  }

  const isMimeTypeValid = ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype.toLowerCase());
  const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some((ext) =>
    file.originalname.toLowerCase().endsWith(ext),
  );

  if (!isMimeTypeValid || !hasValidExtension) {
    return callback(
      new BusinessException(ErrorCode.FILE_INVALID_TYPE, HttpStatus.BAD_REQUEST),
      false,
    );
  }

  callback(null, true);
};

/**
 * Cấu hình Multer chuẩn cho việc tải lên file ảnh và lưu vào memory buffer
 */
export const createMulterImageOptions = (
  maxSizeInBytes: number = DEFAULT_MAX_IMAGE_SIZE,
): MulterOptions => ({
  storage: memoryStorage(),
  limits: {
    fileSize: maxSizeInBytes,
  },
  fileFilter: imageFileFilter,
});

export const multerImageOptions = createMulterImageOptions();
