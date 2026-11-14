import { Test, TestingModule } from '@nestjs/testing';
import { DailyQuotaController } from './daily-quota.controller';
import { DailyQuotaService } from './daily-quota.service';
import { QueryAdminQuotasDto } from './dto/query-admin-quotas.dto';
import { UpdateQuotaOverrideDto } from './dto/update-quota-override.dto';

describe('DailyQuotaController', () => {
  let controller: DailyQuotaController;
  let service: jest.Mocked<DailyQuotaService>;

  const mockDailyQuotaService = {
    getMeQuota: jest.fn(),
    getAdminQuotas: jest.fn(),
    getUserQuotaHistory: jest.fn(),
    updateUserQuotaOverride: jest.fn(),
    resetUserQuota: jest.fn(),
  };

  const userId = 'user-123';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyQuotaController],
      providers: [
        {
          provide: DailyQuotaService,
          useValue: mockDailyQuotaService,
        },
      ],
    }).compile();

    controller = module.get<DailyQuotaController>(DailyQuotaController);
    service = module.get(DailyQuotaService);
  });

  it('phải khởi tạo DailyQuotaController thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyQuota', () => {
    it('gọi service.getMeQuota và trả về dữ liệu quota của user', async () => {
      const mockResult = {
        date: '2026-10-10',
        examsCreated: 2,
        limit: 5,
        remaining: 3,
        resetAt: '2026-10-11T00:00:00Z',
      };
      mockDailyQuotaService.getMeQuota.mockResolvedValue(mockResult);

      const response = await controller.getMyQuota({ sub: userId });

      expect(service.getMeQuota).toHaveBeenCalledWith(userId);
      expect(response.data).toEqual(mockResult);
      expect(response.remaining).toBe(3);
    });
  });

  describe('getAdminQuotas', () => {
    it('gọi service.getAdminQuotas với query và trả về danh sách', async () => {
      const mockResult = {
        data: [{ userId, examsCreated: 5, limit: 5, isOverLimitRisk: true }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      mockDailyQuotaService.getAdminQuotas.mockResolvedValue(mockResult as any);

      const query: QueryAdminQuotasDto = {
        date: '2026-10-10',
        page: 1,
        limit: 20,
        skip: 0,
      };
      const response = await controller.getAdminQuotas(query);

      expect(service.getAdminQuotas).toHaveBeenCalledWith(query);
      expect(response.data).toEqual(mockResult.data);
      expect(response.pagination).toEqual(mockResult.pagination);
    });
  });

  describe('getUserQuotaHistory', () => {
    it('gọi service.getUserQuotaHistory với userId', async () => {
      const mockResult = [{ userId, date: '2026-10-10', examsCreated: 3, limit: 5 }];
      mockDailyQuotaService.getUserQuotaHistory.mockResolvedValue(mockResult as any);

      const response = await controller.getUserQuotaHistory(userId);

      expect(service.getUserQuotaHistory).toHaveBeenCalledWith(userId);
      expect(response.data).toEqual(mockResult);
    });
  });

  describe('updateQuotaOverride', () => {
    it('gọi service.updateUserQuotaOverride với userId và dto', async () => {
      const dto: UpdateQuotaOverrideDto = { examQuotaOverride: 15 };
      const mockResult = { userId, examQuotaOverride: 15 };
      mockDailyQuotaService.updateUserQuotaOverride.mockResolvedValue(mockResult as any);

      const response = await controller.updateQuotaOverride(userId, dto);

      expect(service.updateUserQuotaOverride).toHaveBeenCalledWith(userId, dto);
      expect(response.data).toEqual(mockResult);
    });
  });

  describe('resetQuota', () => {
    it('gọi service.resetUserQuota với userId và date', async () => {
      const mockResult = { userId, date: '2026-10-10', examsCreated: 0 };
      mockDailyQuotaService.resetUserQuota.mockResolvedValue(mockResult as any);

      const response = await controller.resetQuota(userId, '2026-10-10');

      expect(service.resetUserQuota).toHaveBeenCalledWith(userId, '2026-10-10');
      expect(response.data).toEqual(mockResult);
    });
  });
});
