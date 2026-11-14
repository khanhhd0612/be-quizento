import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { DailyQuotaService, getTodayString } from './daily-quota.service';
import { DailyQuotaRepository } from './daily-quota.repository';
import { User } from '@modules/user/entities/user.entity';
import { SystemConfigService } from '@modules/system-config/system-config.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

describe('DailyQuotaService', () => {
  let service: DailyQuotaService;
  let repository: jest.Mocked<DailyQuotaRepository>;
  let systemConfigService: jest.Mocked<SystemConfigService>;

  const mockUserModel = {
    findOne: jest.fn(),
  };

  const mockRepository = {
    findByUserAndDate: jest.fn(),
    incrementCreated: jest.fn(),
    resetCreated: jest.fn(),
    findByUser: jest.fn(),
    findWithPagination: jest.fn(),
  };

  const mockSystemConfigService = {
    getDailyExamQuota: jest.fn(),
  };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyQuotaService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: DailyQuotaRepository,
          useValue: mockRepository,
        },
        {
          provide: SystemConfigService,
          useValue: mockSystemConfigService,
        },
      ],
    }).compile();

    service = module.get<DailyQuotaService>(DailyQuotaService);
    repository = module.get(DailyQuotaRepository);
    systemConfigService = module.get(SystemConfigService);

    mockSystemConfigService.getDailyExamQuota.mockResolvedValue(5);
  });

  it('phải khởi tạo DailyQuotaService thành công', () => {
    expect(service).toBeDefined();
  });

  describe('getUserEffectiveQuota', () => {
    it('ưu tiên trả về examQuotaOverride nếu user có cấu hình riêng', async () => {
      const user = { examQuotaOverride: 10 } as any;
      const quota = await service.getUserEffectiveQuota(user);
      expect(quota).toBe(10);
      expect(mockSystemConfigService.getDailyExamQuota).not.toHaveBeenCalled();
    });

    it('fallback sang quota mặc định của hệ thống nếu examQuotaOverride là null hoặc undefined', async () => {
      const user = { examQuotaOverride: null } as any;
      const quota = await service.getUserEffectiveQuota(user);
      expect(quota).toBe(5);
      expect(mockSystemConfigService.getDailyExamQuota).toHaveBeenCalled();
    });
  });

  describe('getMeQuota', () => {
    it('ném lỗi USER_NOT_FOUND nếu không tìm thấy user', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getMeQuota(userId)).rejects.toMatchObject({
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    });

    it('trả về quota tính toán chính xác khi chưa tạo đề nào hôm nay (examsCreated = 0)', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        examQuotaOverride: null,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRepository.findByUserAndDate.mockResolvedValue(null);

      const result = await service.getMeQuota(userId);

      expect(result.date).toBe(getTodayString());
      expect(result.examsCreated).toBe(0);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(5);
      expect(result.resetAt).toBeDefined();
    });

    it('trả về quota tính toán chính xác khi đã tạo một số đề trong ngày', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        examQuotaOverride: 8,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRepository.findByUserAndDate.mockResolvedValue({
        examsCreated: 3,
      } as any);

      const result = await service.getMeQuota(userId);

      expect(result.examsCreated).toBe(3);
      expect(result.limit).toBe(8);
      expect(result.remaining).toBe(5);
    });
  });

  describe('checkQuota', () => {
    it('ném lỗi 429 DAILY_QUOTA_EXCEEDED nếu số đề đã tạo >= limit', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        examQuotaOverride: 5,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRepository.findByUserAndDate.mockResolvedValue({
        examsCreated: 5,
      } as any);

      await expect(service.checkQuota(userId)).rejects.toMatchObject({
        errorCode: ErrorCode.DAILY_QUOTA_EXCEEDED,
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('thành công nếu số đề đã tạo < limit', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        examQuotaOverride: 5,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRepository.findByUserAndDate.mockResolvedValue({
        examsCreated: 2,
      } as any);

      const result = await service.checkQuota(userId);
      expect(result.examsCreated).toBe(2);
      expect(result.limit).toBe(5);
    });
  });

  describe('consumeQuota', () => {
    it('gọi repository.incrementCreated với userId và ngày hôm nay', async () => {
      mockRepository.incrementCreated.mockResolvedValue({} as any);

      await service.consumeQuota(userId);

      expect(mockRepository.incrementCreated).toHaveBeenCalledWith(userId, getTodayString());
    });
  });

  describe('getAdminQuotas', () => {
    it('lấy danh sách phân trang và tính toán isOverLimitRisk', async () => {
      const user1 = {
        _id: new Types.ObjectId(),
        fullName: 'Nguyễn Văn A',
        examQuotaOverride: 5,
      };
      const user2 = {
        _id: new Types.ObjectId(),
        fullName: 'Trần Thị B',
        examQuotaOverride: null,
      };

      const items = [
        {
          userId: user1,
          date: '2026-10-10',
          examsCreated: 5,
        },
        {
          userId: user2,
          date: '2026-10-10',
          examsCreated: 2,
        },
      ];

      mockRepository.findWithPagination.mockResolvedValue({
        items: items as any,
        total: 2,
      });

      const result = await service.getAdminQuotas({
        date: '2026-10-10',
        page: 1,
        limit: 20,
        skip: 0,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        displayName: 'Nguyễn Văn A',
        examsCreated: 5,
        limit: 5,
        isOverLimitRisk: true,
      });
      expect(result.data[1]).toMatchObject({
        displayName: 'Trần Thị B',
        examsCreated: 2,
        limit: 5,
        isOverLimitRisk: false,
      });
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('getUserQuotaHistory', () => {
    it('ném lỗi QUOTA_RECORD_NOT_FOUND nếu user chưa có bản ghi nào', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        fullName: 'Test User',
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRepository.findByUser.mockResolvedValue([]);

      await expect(service.getUserQuotaHistory(userId)).rejects.toMatchObject({
        errorCode: ErrorCode.QUOTA_RECORD_NOT_FOUND,
      });
    });

    it('trả về danh sách lịch sử quota của user', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        fullName: 'Test User',
        examQuotaOverride: 5,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRepository.findByUser.mockResolvedValue([
        { date: '2026-10-10', examsCreated: 5 },
        { date: '2026-10-09', examsCreated: 1 },
      ] as any);

      const result = await service.getUserQuotaHistory(userId);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-10-10');
      expect(result[0].isOverLimitRisk).toBe(true);
      expect(result[1].isOverLimitRisk).toBe(false);
    });
  });

  describe('updateUserQuotaOverride', () => {
    it('ném lỗi INVALID_QUOTA_OVERRIDE nếu giá trị âm', async () => {
      const mockUser = { _id: new Types.ObjectId(userId), save: jest.fn() };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        service.updateUserQuotaOverride(userId, { examQuotaOverride: -1 }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.INVALID_QUOTA_OVERRIDE,
      });
    });

    it('cập nhật thành công số quota riêng cho user', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        examQuotaOverride: null,
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.updateUserQuotaOverride(userId, {
        examQuotaOverride: 15,
      });

      expect(mockUser.examQuotaOverride).toBe(15);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.examQuotaOverride).toBe(15);
    });

    it('gỡ bỏ quota riêng khi truyền null', async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        examQuotaOverride: 15,
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.updateUserQuotaOverride(userId, {
        examQuotaOverride: null,
      });

      expect(mockUser.examQuotaOverride).toBeNull();
      expect(result.examQuotaOverride).toBeNull();
    });
  });

  describe('resetUserQuota', () => {
    it('ném lỗi QUOTA_RECORD_NOT_FOUND nếu không có bản ghi trong ngày', async () => {
      mockRepository.resetCreated.mockResolvedValue(null);

      await expect(service.resetUserQuota(userId, '2026-10-10')).rejects.toMatchObject({
        errorCode: ErrorCode.QUOTA_RECORD_NOT_FOUND,
      });
    });

    it('reset examsCreated về 0 thành công', async () => {
      const mockRecord = {
        userId: new Types.ObjectId(userId),
        date: '2026-10-10',
        examsCreated: 0,
      };
      mockRepository.resetCreated.mockResolvedValue(mockRecord as any);

      const result = await service.resetUserQuota(userId, '2026-10-10');
      expect(result).toEqual(mockRecord);
      expect(mockRepository.resetCreated).toHaveBeenCalledWith(userId, '2026-10-10');
    });
  });
});
