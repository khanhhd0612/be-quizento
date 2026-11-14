import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { buildStorageKey } from '@common/utils/file.util';
import { UploadedFileDto } from './dto/upload-response.dto';

export interface UploadImageOptions {
  folder?: string;
  customFilename?: string;
}

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly endpoint: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('r2.accountId') || '';
    const accessKeyId = this.configService.get<string>('r2.accessKeyId') || '';
    const secretAccessKey = this.configService.get<string>('r2.secretAccessKey') || '';
    this.bucketName = this.configService.get<string>('r2.bucketName') || '';
    this.publicUrl = (this.configService.get<string>('r2.publicUrl') || '').replace(/\/+$/, '');
    this.endpoint =
      this.configService.get<string>('r2.endpoint') ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

    if (accessKeyId && secretAccessKey && this.endpoint) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(
        `Cloudflare R2 Client đã được khởi tạo (Bucket: ${this.bucketName || 'chưa đặt'})`,
      );
    } else {
      this.logger.warn(
        'Cloudflare R2 chưa được cấu hình đầy đủ biến môi trường (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)',
      );
    }
  }

  /**
   * Kiểm tra dịch vụ Cloudflare R2 đã cấu hình hợp lệ chưa
   */
  isConfigured(): boolean {
    return Boolean(this.s3Client && this.bucketName);
  }

  /**
   * Upload một file ảnh lên Cloudflare R2
   */
  async uploadImage(
    file: Express.Multer.File,
    options?: UploadImageOptions,
  ): Promise<UploadedFileDto> {
    if (!file || !file.buffer) {
      throw new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST);
    }

    if (!this.s3Client || !this.bucketName) {
      throw new BusinessException(ErrorCode.R2_NOT_CONFIGURED, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const key = buildStorageKey(options?.folder, file.originalname, options?.customFilename);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      });

      await this.s3Client.send(command);

      const url = this.publicUrl
        ? `${this.publicUrl}/${key}`
        : `${this.endpoint}/${this.bucketName}/${key}`;

      return {
        url,
        key,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        bucket: this.bucketName,
      };
    } catch (error: any) {
      this.logger.error(`Tải file lên Cloudflare R2 thất bại: ${error.message}`, error.stack);
      throw new BusinessException(
        ErrorCode.R2_UPLOAD_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorMessage[ErrorCode.R2_UPLOAD_FAILED],
      );
    }
  }

  /**
   * Upload danh sách nhiều file ảnh lên Cloudflare R2
   */
  async uploadImages(
    files: Express.Multer.File[],
    options?: UploadImageOptions,
  ): Promise<UploadedFileDto[]> {
    if (!files || files.length === 0) {
      throw new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST);
    }

    return Promise.all(files.map((file) => this.uploadImage(file, options)));
  }

  /**
   * Xoá file khỏi Cloudflare R2 theo key
   */
  async deleteFile(key: string): Promise<void> {
    if (!key) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.BAD_REQUEST],
      );
    }

    if (!this.s3Client || !this.bucketName) {
      throw new BusinessException(ErrorCode.R2_NOT_CONFIGURED, HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error: any) {
      this.logger.error(
        `Xoá file trên Cloudflare R2 thất bại (key: ${key}): ${error.message}`,
        error.stack,
      );
      throw new BusinessException(
        ErrorCode.R2_DELETE_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorMessage[ErrorCode.R2_DELETE_FAILED],
      );
    }
  }

  /**
   * Trích xuất S3 Key từ đường dẫn URL đã lưu
   */
  extractKeyFromUrl(url?: string | null): string | null {
    if (!url || typeof url !== 'string') return null;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) return null;

    // Không xoá các avatar mặc định của hệ thống
    if (
      trimmedUrl.includes('shadcn') ||
      trimmedUrl.includes('default') ||
      trimmedUrl.includes('placeholder')
    ) {
      return null;
    }

    try {
      // 1. Nếu bắt đầu bằng publicUrl
      if (this.publicUrl && trimmedUrl.startsWith(this.publicUrl)) {
        const key = trimmedUrl.slice(this.publicUrl.length).replace(/^\/+/, '');
        return key || null;
      }

      // 2. Nếu bắt đầu bằng endpoint/bucketName
      const endpointPrefix = `${this.endpoint}/${this.bucketName}`;
      if (this.endpoint && trimmedUrl.startsWith(endpointPrefix)) {
        const key = trimmedUrl.slice(endpointPrefix.length).replace(/^\/+/, '');
        return key || null;
      }

      // 3. Phân tích qua URL pathname
      const parsed = new URL(trimmedUrl);
      let pathname = parsed.pathname.replace(/^\/+/, '');

      if (this.bucketName && pathname.startsWith(`${this.bucketName}/`)) {
        pathname = pathname.slice(this.bucketName.length + 1);
      }

      // Chỉ chấp nhận các key thuộc folder upload của hệ thống (avatars/, images/, exams/)
      if (
        pathname.startsWith('avatars/') ||
        pathname.startsWith('images/') ||
        pathname.startsWith('exams/')
      ) {
        return pathname;
      }

      return null;
    } catch {
      // Nếu không phải định dạng http(s) URL nhưng chính là key hợp lệ
      if (
        (trimmedUrl.startsWith('avatars/') ||
          trimmedUrl.startsWith('images/') ||
          trimmedUrl.startsWith('exams/')) &&
        !trimmedUrl.includes('://')
      ) {
        return trimmedUrl;
      }
      return null;
    }
  }

  /**
   * Xoá file trên Cloudflare R2 dựa trên URL đã lưu
   */
  async deleteFileByUrl(url?: string | null): Promise<boolean> {
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      return false;
    }

    try {
      await this.deleteFile(key);
      this.logger.log(`Đã xoá file cũ trên Cloudflare R2: ${key}`);
      return true;
    } catch (error: any) {
      this.logger.warn(`Không thể xoá file cũ trên R2 (key: ${key}): ${error.message}`);
      return false;
    }
  }
}
