import { HttpStatus, Injectable } from '@nestjs/common';
import { SystemConfigRepository } from './system-config.repository';
import { AdminConfigResponseDto, PublicConfigResponseDto } from './dto/system-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { MAX_IMAGE_CONFIG_CEILING_BYTES, SystemConfig } from './entities/system-config.entity';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { BusinessException } from '@common/exceptions/business.exception';

@Injectable()
export class SystemConfigService {
  constructor(private readonly systemConfigRepository: SystemConfigRepository) {}

  /**
   * Helper chuyển đổi SystemConfig sang AdminConfigResponseDto
   */
  private mapToAdminDto(config: SystemConfig): AdminConfigResponseDto {
    let updatedBy: { _id: string; fullName: string } | null = null;
    if (config.updatedBy) {
      const u = config.updatedBy as any;
      updatedBy = {
        _id: u._id?.toString() || u.id?.toString() || config.updatedBy.toString(),
        fullName: u.fullName || 'Admin',
      };
    }

    return {
      defaultDailyExamQuota: config.defaultDailyExamQuota,
      maxImageSizeBytes: config.maxImageSizeBytes,
      maxAudioSizeBytes: config.maxAudioSizeBytes,
      maxAudioDurationSeconds: config.maxAudioDurationSeconds,
      maxTotalMediaSizePerExam: config.maxTotalMediaSizePerExam,
      guestPreviewMaxQuestions: config.guestPreviewMaxQuestions,
      guestPreviewMaxPercent: config.guestPreviewMaxPercent,
      updatedAt: config.updatedAt,
      updatedBy,
    };
  }

  /**
   * Lấy toàn bộ cấu hình hệ thống cho trang quản trị (Admin)
   */
  async getAdminConfig(): Promise<AdminConfigResponseDto> {
    const config = await this.systemConfigRepository.getOrInitConfig();
    return this.mapToAdminDto(config);
  }

  /**
   * Lấy tập con cấu hình cần cho client (Public)
   * Phục vụ validate kích thước file, preview giới hạn trên giao diện người dùng
   */
  async getPublicConfig(): Promise<PublicConfigResponseDto> {
    const config = await this.systemConfigRepository.getOrInitConfig();

    return {
      maxImageSizeBytes: config.maxImageSizeBytes,
      maxAudioSizeBytes: config.maxAudioSizeBytes,
      maxAudioDurationSeconds: config.maxAudioDurationSeconds,
      maxTotalMediaSizePerExam: config.maxTotalMediaSizePerExam,
      guestPreviewMaxQuestions: config.guestPreviewMaxQuestions,
      guestPreviewMaxPercent: config.guestPreviewMaxPercent,
    };
  }

  /**
   * Lấy số lượng đề thi tối đa một user được phép tạo trong 1 ngày
   */
  async getDailyExamQuota(): Promise<number> {
    const config = await this.systemConfigRepository.getOrInitConfig();
    return config.defaultDailyExamQuota;
  }

  /**
   * Cập nhật một hoặc nhiều trường cấu hình hệ thống (Admin)
   * Thực hiện đầy đủ các quy tắc validation và ném mã lỗi đặc tả
   */
  async updateConfig(
    dto: UpdateSystemConfigDto,
    adminUserId: string,
  ): Promise<AdminConfigResponseDto> {
    const currentConfig = await this.systemConfigRepository.getOrInitConfig();

    // 1. defaultDailyExamQuota: Số nguyên dương, tối thiểu 1 -> 400 INVALID_QUOTA_VALUE
    if (dto.defaultDailyExamQuota !== undefined) {
      if (!Number.isInteger(dto.defaultDailyExamQuota) || dto.defaultDailyExamQuota < 1) {
        throw new BusinessException(
          ErrorCode.INVALID_QUOTA_VALUE,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_QUOTA_VALUE],
        );
      }
    }

    // 2. maxImageSizeBytes: Số dương, trần tối đa MAX_IMAGE_CONFIG_CEILING_BYTES (20MB) -> 400 INVALID_IMAGE_LIMIT
    if (dto.maxImageSizeBytes !== undefined) {
      if (
        typeof dto.maxImageSizeBytes !== 'number' ||
        dto.maxImageSizeBytes <= 0 ||
        dto.maxImageSizeBytes > MAX_IMAGE_CONFIG_CEILING_BYTES
      ) {
        throw new BusinessException(
          ErrorCode.INVALID_IMAGE_LIMIT,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_IMAGE_LIMIT],
        );
      }
    }

    // 3. maxAudioSizeBytes & maxAudioDurationSeconds: Số dương -> 400 INVALID_AUDIO_LIMIT
    if (dto.maxAudioSizeBytes !== undefined) {
      if (typeof dto.maxAudioSizeBytes !== 'number' || dto.maxAudioSizeBytes <= 0) {
        throw new BusinessException(
          ErrorCode.INVALID_AUDIO_LIMIT,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_AUDIO_LIMIT],
        );
      }
    }

    if (dto.maxAudioDurationSeconds !== undefined) {
      if (typeof dto.maxAudioDurationSeconds !== 'number' || dto.maxAudioDurationSeconds <= 0) {
        throw new BusinessException(
          ErrorCode.INVALID_AUDIO_LIMIT,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_AUDIO_LIMIT],
        );
      }
    }

    // 4. maxTotalMediaSizePerExam: Phải >= maxImageSizeBytes và >= maxAudioSizeBytes -> 400 TOTAL_LIMIT_TOO_LOW
    const effectiveTotal =
      dto.maxTotalMediaSizePerExam !== undefined
        ? dto.maxTotalMediaSizePerExam
        : currentConfig.maxTotalMediaSizePerExam;

    const effectiveImage =
      dto.maxImageSizeBytes !== undefined ? dto.maxImageSizeBytes : currentConfig.maxImageSizeBytes;

    const effectiveAudio =
      dto.maxAudioSizeBytes !== undefined ? dto.maxAudioSizeBytes : currentConfig.maxAudioSizeBytes;

    if (effectiveTotal < effectiveImage || effectiveTotal < effectiveAudio) {
      throw new BusinessException(
        ErrorCode.TOTAL_LIMIT_TOO_LOW,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.TOTAL_LIMIT_TOO_LOW],
      );
    }

    // 5. guestPreviewMaxPercent: Trong khoảng (0, 1] -> 400 INVALID_PREVIEW_PERCENT
    if (dto.guestPreviewMaxPercent !== undefined) {
      if (
        typeof dto.guestPreviewMaxPercent !== 'number' ||
        dto.guestPreviewMaxPercent <= 0 ||
        dto.guestPreviewMaxPercent > 1
      ) {
        throw new BusinessException(
          ErrorCode.INVALID_PREVIEW_PERCENT,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_PREVIEW_PERCENT],
        );
      }
    }

    // 6. guestPreviewMaxQuestions: Số nguyên dương >= 1 -> 400 INVALID_PREVIEW_COUNT
    if (dto.guestPreviewMaxQuestions !== undefined) {
      if (!Number.isInteger(dto.guestPreviewMaxQuestions) || dto.guestPreviewMaxQuestions < 1) {
        throw new BusinessException(
          ErrorCode.INVALID_PREVIEW_COUNT,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_PREVIEW_COUNT],
        );
      }
    }

    const updated = await this.systemConfigRepository.updateConfig(dto, adminUserId);
    return this.mapToAdminDto(updated);
  }
}
