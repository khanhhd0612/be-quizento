import { Injectable } from '@nestjs/common';
import { R2Service, UploadImageOptions } from './r2.service';
import { UploadedFileDto } from './dto/upload-response.dto';

@Injectable()
export class UploadService {
  constructor(private readonly r2Service: R2Service) {}

  /**
   * Tải lên một ảnh đơn lẻ
   */
  async uploadSingleImage(
    file: Express.Multer.File,
    options?: UploadImageOptions,
  ): Promise<UploadedFileDto> {
    return this.r2Service.uploadImage(file, options);
  }

  /**
   * Tải lên một file audio đơn lẻ
   */
  async uploadSingleAudio(
    file: Express.Multer.File,
    options?: UploadImageOptions,
  ): Promise<UploadedFileDto> {
    return this.r2Service.uploadImage(file, options);
  }

  /**
   * Tải lên nhiều ảnh cùng lúc
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
    options?: UploadImageOptions,
  ): Promise<UploadedFileDto[]> {
    return this.r2Service.uploadImages(files, options);
  }

  /**
   * Xoá ảnh khỏi R2
   */
  async deleteImage(key: string): Promise<void> {
    return this.r2Service.deleteFile(key);
  }

  /**
   * Xoá ảnh khỏi R2 dựa theo URL công khai đã lưu
   */
  async deleteFileByUrl(url?: string | null): Promise<boolean> {
    if (!url) return false;
    return this.r2Service.deleteFileByUrl(url);
  }
}
