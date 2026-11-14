import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types, isValidObjectId } from 'mongoose';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { BusinessException } from '@common/exceptions/business.exception';
import { User } from '@modules/user/entities/user.entity';
import { SystemConfigService } from '@modules/system-config/system-config.service';
import { DailyQuota } from './entities/daily-quota.entity';
import { DailyQuotaRepository } from './daily-quota.repository';
import { QueryAdminQuotasDto } from './dto/query-admin-quotas.dto';
import { UpdateQuotaOverrideDto } from './dto/update-quota-override.dto';

export interface UserQuotaResponse {
  date: string;
  examsCreated: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

import { getNextDayResetAt, getTodayString } from '@common/utils/date.util';

export { getNextDayResetAt, getTodayString };

@Injectable()
export class DailyQuotaService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly dailyQuotaRepository: DailyQuotaRepository,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * Tính giới hạn quota có hiệu lực của user
   */
  async getUserEffectiveQuota(user?: User | null): Promise<number> {
    if (user && user.examQuotaOverride !== null && user.examQuotaOverride !== undefined) {
      return user.examQuotaOverride;
    }
    return this.systemConfigService.getDailyExamQuota();
  }

  /**
   * Xem quota của chính mình (GET /users/me/quota)
   */
  async getMeQuota(userId: string): Promise<UserQuotaResponse> {
    if (!isValidObjectId(userId)) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    const user = await this.userModel.findOne({ _id: userId, deletedAt: null }).exec();

    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    const today = getTodayString();
    const limit = await this.getUserEffectiveQuota(user);
    const record = await this.dailyQuotaRepository.findByUserAndDate(userId, today);

    const examsCreated = record?.examsCreated ?? 0;
    const remaining = Math.max(0, limit - examsCreated);
    const resetAt = getNextDayResetAt(today);

    return {
      date: today,
      examsCreated,
      limit,
      remaining,
      resetAt,
    };
  }

  /**
   * Kiểm tra quota trước khi tạo đề (Dùng nội bộ khi POST /exams)
   */
  async checkQuota(
    userId: string,
  ): Promise<{ limit: number; examsCreated: number; today: string }> {
    const user = isValidObjectId(userId)
      ? await this.userModel.findOne({ _id: userId, deletedAt: null }).exec()
      : null;

    const limit = await this.getUserEffectiveQuota(user);
    const today = getTodayString();
    const record = await this.dailyQuotaRepository.findByUserAndDate(userId, today);

    const examsCreated = record?.examsCreated ?? 0;

    if (examsCreated >= limit) {
      throw new BusinessException(
        ErrorCode.DAILY_QUOTA_EXCEEDED,
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorMessage[ErrorCode.DAILY_QUOTA_EXCEEDED],
      );
    }

    return { limit, examsCreated, today };
  }

  /**
   * Ghi nhận đã tạo 1 đề thi thành công trong ngày
   */
  async consumeQuota(userId: string): Promise<void> {
    const today = getTodayString();
    await this.dailyQuotaRepository.incrementCreated(userId, today);
  }

  /**
   * Danh sách quota đã dùng theo ngày cho Admin (GET /admin/quotas)
   */
  async getAdminQuotas(query: QueryAdminQuotasDto) {
    const date = query.date || getTodayString();
    const filter: FilterQuery<DailyQuota> = { date, deletedAt: null };

    if (query.minUsed !== undefined && query.minUsed !== null) {
      filter.examsCreated = { $gte: Number(query.minUsed) };
    }

    const defaultQuota = await this.systemConfigService.getDailyExamQuota();
    const { items, total } = await this.dailyQuotaRepository.findWithPagination(
      filter,
      { examsCreated: -1, createdAt: -1 },
      query.skip,
      query.limit,
    );

    const data = items.map((item) => {
      const user = item.userId as any;
      const limit =
        user?.examQuotaOverride !== null && user?.examQuotaOverride !== undefined
          ? user.examQuotaOverride
          : defaultQuota;

      return {
        userId: user?._id?.toString() || user?.id?.toString() || item.userId?.toString(),
        displayName: user?.fullName || 'Người dùng',
        date: item.date,
        examsCreated: item.examsCreated,
        limit,
        isOverLimitRisk: item.examsCreated >= limit,
      };
    });

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
      },
    };
  }

  /**
   * Lịch sử quota của 1 user cụ thể cho Admin (GET /admin/quotas/:userId)
   */
  async getUserQuotaHistory(targetUserId: string) {
    if (!isValidObjectId(targetUserId)) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    const user = await this.userModel.findOne({ _id: targetUserId, deletedAt: null }).exec();

    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    const records = await this.dailyQuotaRepository.findByUser(targetUserId);
    if (!records || records.length === 0) {
      throw new BusinessException(
        ErrorCode.QUOTA_RECORD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUOTA_RECORD_NOT_FOUND],
      );
    }

    const defaultQuota = await this.systemConfigService.getDailyExamQuota();
    const limit =
      user.examQuotaOverride !== null && user.examQuotaOverride !== undefined
        ? user.examQuotaOverride
        : defaultQuota;

    return records.map((record) => ({
      userId: user._id.toString(),
      displayName: user.fullName,
      date: record.date,
      examsCreated: record.examsCreated,
      limit,
      isOverLimitRisk: record.examsCreated >= limit,
    }));
  }

  /**
   * Cập nhật / gỡ quota riêng cho 1 user (PATCH /admin/users/:userId/quota-override)
   */
  async updateUserQuotaOverride(targetUserId: string, dto: UpdateQuotaOverrideDto) {
    if (!isValidObjectId(targetUserId)) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    const user = await this.userModel.findOne({ _id: targetUserId, deletedAt: null }).exec();

    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    if (
      dto.examQuotaOverride !== null &&
      dto.examQuotaOverride !== undefined &&
      (dto.examQuotaOverride < 0 || !Number.isInteger(dto.examQuotaOverride))
    ) {
      throw new BusinessException(
        ErrorCode.INVALID_QUOTA_OVERRIDE,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.INVALID_QUOTA_OVERRIDE],
      );
    }

    user.examQuotaOverride = dto.examQuotaOverride ?? null;
    await user.save();

    return {
      userId: user._id.toString(),
      examQuotaOverride: user.examQuotaOverride,
    };
  }

  /**
   * Reset quota đã dùng trong ngày về 0 (DELETE /admin/quotas/:userId/:date)
   */
  async resetUserQuota(targetUserId: string, date: string) {
    if (!isValidObjectId(targetUserId)) {
      throw new BusinessException(
        ErrorCode.QUOTA_RECORD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUOTA_RECORD_NOT_FOUND],
      );
    }

    const record = await this.dailyQuotaRepository.resetCreated(targetUserId, date);

    if (!record) {
      throw new BusinessException(
        ErrorCode.QUOTA_RECORD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUOTA_RECORD_NOT_FOUND],
      );
    }

    return record;
  }
}
