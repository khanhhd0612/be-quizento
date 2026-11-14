import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Làm sạch tên file, loại bỏ ký tự lạ, giới hạn độ dài tối đa 50 ký tự
 */
export function sanitizeFilename(filename: string): string {
  return (
    filename
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'image'
  );
}

/**
 * Tạo key lưu trữ cho Cloudflare R2 / S3 dạng folder/YYYY-MM-DD/uuid-filename.ext
 */
export function buildStorageKey(
  folder: string = 'images',
  originalname: string,
  customFilename?: string,
): string {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '') || 'images';
  const ext = path.extname(originalname).toLowerCase() || '.png';
  const baseName = customFilename
    ? path.parse(customFilename).name
    : path.parse(originalname).name;

  const sanitized = sanitizeFilename(baseName);
  const dateFolder = new Date().toISOString().slice(0, 10);

  return `${cleanFolder}/${dateFolder}/${uuidv4()}-${sanitized}${ext}`;
}
