import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';

describe('SystemConfigController', () => {
  let controller: SystemConfigController;
  let service: jest.Mocked<SystemConfigService>;

  const mockSystemConfigService = {
    getAdminConfig: jest.fn(),
    getPublicConfig: jest.fn(),
    updateConfig: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemConfigController],
      providers: [
        {
          provide: SystemConfigService,
          useValue: mockSystemConfigService,
        },
      ],
    }).compile();

    controller = module.get<SystemConfigController>(SystemConfigController);
    service = module.get(SystemConfigService);
  });

  it('phải khởi tạo SystemConfigController thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('getAdminConfig', () => {
    it('gọi service.getAdminConfig và trả về message kèm data', async () => {
      const mockAdminConfig = {
        defaultDailyExamQuota: 5,
        maxImageSizeBytes: 2097152,
        maxAudioSizeBytes: 5242880,
        maxAudioDurationSeconds: 120,
        maxTotalMediaSizePerExam: 52428800,
        guestPreviewMaxQuestions: 10,
        guestPreviewMaxPercent: 0.5,
        updatedAt: new Date('2026-10-01T08:00:00Z'),
        updatedBy: { _id: 'admin-1', fullName: 'Admin Nguyễn' },
      };

      mockSystemConfigService.getAdminConfig.mockResolvedValue(mockAdminConfig);

      const result = await controller.getAdminConfig();

      expect(service.getAdminConfig).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'Lấy cấu hình quản trị thành công',
        data: mockAdminConfig,
      });
    });
  });

  describe('getPublicConfig', () => {
    it('gọi service.getPublicConfig và trả về message kèm data', async () => {
      const mockPublicConfig = {
        maxImageSizeBytes: 2097152,
        maxAudioSizeBytes: 5242880,
        maxAudioDurationSeconds: 120,
        maxTotalMediaSizePerExam: 52428800,
        guestPreviewMaxQuestions: 10,
        guestPreviewMaxPercent: 0.5,
      };

      mockSystemConfigService.getPublicConfig.mockResolvedValue(mockPublicConfig);

      const result = await controller.getPublicConfig();

      expect(service.getPublicConfig).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        message: 'Lấy cấu hình public thành công',
        data: mockPublicConfig,
      });
    });
  });

  describe('updateConfig', () => {
    it('gọi service.updateConfig với dto và user sub, trả về message kèm data', async () => {
      const mockUpdated = {
        defaultDailyExamQuota: 8,
        maxImageSizeBytes: 3145728,
        maxAudioSizeBytes: 5242880,
        maxAudioDurationSeconds: 120,
        maxTotalMediaSizePerExam: 52428800,
        guestPreviewMaxQuestions: 10,
        guestPreviewMaxPercent: 0.5,
        updatedAt: new Date('2026-10-10T10:00:00Z'),
        updatedBy: { _id: 'admin-1', fullName: 'Admin Nguyễn' },
      };

      mockSystemConfigService.updateConfig.mockResolvedValue(mockUpdated);

      const dto = {
        defaultDailyExamQuota: 8,
        maxImageSizeBytes: 3145728,
      };

      const result = await controller.updateConfig(dto, { sub: 'admin-1' });

      expect(service.updateConfig).toHaveBeenCalledWith(dto, 'admin-1');
      expect(result).toEqual({
        message: 'Cập nhật cấu hình hệ thống thành công',
        data: mockUpdated,
      });
    });
  });
});
