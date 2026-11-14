import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { SystemConfigService } from './system-config.service';
import { SystemConfigRepository } from './system-config.repository';
import { DEFAULT_SYSTEM_CONFIG, SystemConfig } from './entities/system-config.entity';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let repository: jest.Mocked<SystemConfigRepository>;

  const mockSystemConfigRepository = {
    getOrInitConfig: jest.fn(),
    updateConfig: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        {
          provide: SystemConfigRepository,
          useValue: mockSystemConfigRepository,
        },
      ],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
    repository = module.get(SystemConfigRepository);
  });

  it('phải khởi tạo SystemConfigService thành công', () => {
    expect(service).toBeDefined();
  });

  describe('getAdminConfig', () => {
    it('trả về đầy đủ cấu hình quản trị kèm thông tin updatedBy', async () => {
      const adminId = new Types.ObjectId().toString();
      const mockUpdatedAt = new Date('2026-10-01T08:00:00Z');

      const mockConfig: SystemConfig = {
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: mockUpdatedAt,
        updatedBy: {
          _id: new Types.ObjectId(adminId),
          fullName: 'Admin Nguyễn',
        } as any,
      };

      repository.getOrInitConfig.mockResolvedValue(mockConfig);

      const result = await service.getAdminConfig();

      expect(repository.getOrInitConfig).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        defaultDailyExamQuota: 5,
        maxImageSizeBytes: 2097152,
        maxAudioSizeBytes: 5242880,
        maxAudioDurationSeconds: 120,
        maxTotalMediaSizePerExam: 52428800,
        guestPreviewMaxQuestions: 10,
        guestPreviewMaxPercent: 0.5,
        updatedAt: mockUpdatedAt,
        updatedBy: {
          _id: adminId,
          fullName: 'Admin Nguyễn',
        },
      });
    });

    it('trả về updatedBy là null nếu chưa từng có admin nào chỉnh sửa', async () => {
      const mockUpdatedAt = new Date('2026-10-01T08:00:00Z');

      const mockConfig: SystemConfig = {
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: mockUpdatedAt,
        updatedBy: null,
      };

      repository.getOrInitConfig.mockResolvedValue(mockConfig);

      const result = await service.getAdminConfig();

      expect(result.updatedBy).toBeNull();
      expect(result.defaultDailyExamQuota).toBe(5);
    });
  });

  describe('getPublicConfig', () => {
    it('chỉ trả về tập con cần thiết cho client, không lộ các trường nhạy cảm/quản trị', async () => {
      const mockConfig: SystemConfig = {
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: new Date(),
        updatedBy: {
          _id: new Types.ObjectId(),
          fullName: 'Admin Nguyễn',
        } as any,
      };

      repository.getOrInitConfig.mockResolvedValue(mockConfig);

      const result = await service.getPublicConfig();

      expect(repository.getOrInitConfig).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        maxImageSizeBytes: 2097152,
        maxAudioSizeBytes: 5242880,
        maxAudioDurationSeconds: 120,
        maxTotalMediaSizePerExam: 52428800,
        guestPreviewMaxQuestions: 10,
        guestPreviewMaxPercent: 0.5,
      });

      // Đảm bảo không chứa các trường admin
      expect((result as any).defaultDailyExamQuota).toBeUndefined();
      expect((result as any).updatedBy).toBeUndefined();
      expect((result as any).updatedAt).toBeUndefined();
      expect((result as any)._id).toBeUndefined();
    });
  });

  describe('getDailyExamQuota', () => {
    it('trả về đúng defaultDailyExamQuota từ cấu hình', async () => {
      const mockConfig: SystemConfig = {
        ...DEFAULT_SYSTEM_CONFIG,
        defaultDailyExamQuota: 10,
        updatedAt: new Date(),
      };

      repository.getOrInitConfig.mockResolvedValue(mockConfig);

      const result = await service.getDailyExamQuota();

      expect(repository.getOrInitConfig).toHaveBeenCalledTimes(1);
      expect(result).toBe(10);
    });
  });

  describe('updateConfig', () => {
    const adminId = new Types.ObjectId().toString();

    it('cập nhật thành công khi dữ liệu hợp lệ', async () => {
      const currentConfig: SystemConfig = {
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: new Date('2026-10-01T08:00:00Z'),
        updatedBy: null,
      };

      repository.getOrInitConfig.mockResolvedValue(currentConfig);

      const updatedConfig: SystemConfig = {
        ...currentConfig,
        defaultDailyExamQuota: 8,
        maxImageSizeBytes: 3145728,
        updatedAt: new Date('2026-10-10T10:00:00Z'),
        updatedBy: {
          _id: new Types.ObjectId(adminId),
          fullName: 'Admin Nguyễn',
        } as any,
      };

      repository.updateConfig.mockResolvedValue(updatedConfig);

      const result = await service.updateConfig(
        {
          defaultDailyExamQuota: 8,
          maxImageSizeBytes: 3145728,
        },
        adminId,
      );

      expect(repository.updateConfig).toHaveBeenCalledWith(
        {
          defaultDailyExamQuota: 8,
          maxImageSizeBytes: 3145728,
        },
        adminId,
      );
      expect(result.defaultDailyExamQuota).toBe(8);
      expect(result.maxImageSizeBytes).toBe(3145728);
      expect(result.updatedBy?._id).toBe(adminId);
    });

    it('ném lỗi INVALID_QUOTA_VALUE nếu defaultDailyExamQuota < 1 hoặc không phải số nguyên', async () => {
      repository.getOrInitConfig.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: new Date(),
        updatedBy: null,
      });

      await expect(service.updateConfig({ defaultDailyExamQuota: 0 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_QUOTA_VALUE,
          status: 400,
        }),
      );

      await expect(service.updateConfig({ defaultDailyExamQuota: 2.5 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_QUOTA_VALUE,
          status: 400,
        }),
      );
    });

    it('ném lỗi INVALID_IMAGE_LIMIT nếu maxImageSizeBytes <= 0 hoặc > 20MB', async () => {
      repository.getOrInitConfig.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: new Date(),
        updatedBy: null,
      });

      await expect(service.updateConfig({ maxImageSizeBytes: 0 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_IMAGE_LIMIT,
          status: 400,
        }),
      );

      // > 20MB (20 * 1024 * 1024 + 1)
      await expect(service.updateConfig({ maxImageSizeBytes: 20971521 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_IMAGE_LIMIT,
          status: 400,
        }),
      );
    });

    it('ném lỗi INVALID_AUDIO_LIMIT nếu maxAudioSizeBytes hoặc maxAudioDurationSeconds <= 0', async () => {
      repository.getOrInitConfig.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: new Date(),
        updatedBy: null,
      });

      await expect(service.updateConfig({ maxAudioSizeBytes: -1 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_AUDIO_LIMIT,
          status: 400,
        }),
      );

      await expect(service.updateConfig({ maxAudioDurationSeconds: 0 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_AUDIO_LIMIT,
          status: 400,
        }),
      );
    });

    it('ném lỗi TOTAL_LIMIT_TOO_LOW nếu maxTotalMediaSizePerExam < maxImageSizeBytes hoặc < maxAudioSizeBytes', async () => {
      repository.getOrInitConfig.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG, // maxImage: 2MB, maxAudio: 5MB
        updatedAt: new Date(),
        updatedBy: null,
      });

      // Đặt tổng media là 4MB (nhỏ hơn maxAudio 5MB)
      await expect(
        service.updateConfig({ maxTotalMediaSizePerExam: 4194304 }, adminId),
      ).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.TOTAL_LIMIT_TOO_LOW,
          status: 400,
        }),
      );

      // Đặt maxImageSizeBytes là 60MB (lớn hơn current maxTotal 50MB)
      await expect(
        service.updateConfig(
          { maxImageSizeBytes: 10 * 1024 * 1024, maxTotalMediaSizePerExam: 8 * 1024 * 1024 },
          adminId,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.TOTAL_LIMIT_TOO_LOW,
          status: 400,
        }),
      );
    });

    it('ném lỗi INVALID_PREVIEW_PERCENT nếu guestPreviewMaxPercent <= 0 hoặc > 1', async () => {
      repository.getOrInitConfig.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: new Date(),
        updatedBy: null,
      });

      await expect(service.updateConfig({ guestPreviewMaxPercent: 0 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_PREVIEW_PERCENT,
          status: 400,
        }),
      );

      await expect(service.updateConfig({ guestPreviewMaxPercent: 1.2 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_PREVIEW_PERCENT,
          status: 400,
        }),
      );
    });

    it('ném lỗi INVALID_PREVIEW_COUNT nếu guestPreviewMaxQuestions < 1 hoặc không phải số nguyên', async () => {
      repository.getOrInitConfig.mockResolvedValue({
        ...DEFAULT_SYSTEM_CONFIG,
        updatedAt: new Date(),
        updatedBy: null,
      });

      await expect(service.updateConfig({ guestPreviewMaxQuestions: 0 }, adminId)).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_PREVIEW_COUNT,
          status: 400,
        }),
      );

      await expect(
        service.updateConfig({ guestPreviewMaxQuestions: 3.5 }, adminId),
      ).rejects.toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.INVALID_PREVIEW_COUNT,
          status: 400,
        }),
      );
    });
  });
});
