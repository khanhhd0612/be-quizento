import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types, isValidObjectId } from 'mongoose';
import {
  DAILY_QUOTA_RETENTION_DAYS,
  DailyQuota,
  DailyQuotaDocument,
} from './entities/daily-quota.entity';

@Injectable()
export class DailyQuotaRepository {
  constructor(
    @InjectModel(DailyQuota.name)
    private readonly dailyQuotaModel: Model<DailyQuotaDocument>,
  ) {}

  /**
   * Tìm bản ghi quota theo userId và date
   */
  async findByUserAndDate(
    userId: string | Types.ObjectId,
    date: string,
  ): Promise<DailyQuotaDocument | null> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.dailyQuotaModel.findOne({ userId: userObjectId, date, deletedAt: null }).exec();
  }

  /**
   * Tăng số lượng đề đã tạo trong ngày (upsert = true)
   */
  async incrementCreated(
    userId: string | Types.ObjectId,
    date: string,
  ): Promise<DailyQuotaDocument> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DAILY_QUOTA_RETENTION_DAYS);

    return this.dailyQuotaModel
      .findOneAndUpdate(
        { userId: userObjectId, date, deletedAt: null },
        {
          $inc: { examsCreated: 1 },
          $setOnInsert: { expiresAt },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  /**
   * Reset số đề đã tạo trong ngày về 0
   */
  async resetCreated(
    userId: string | Types.ObjectId,
    date: string,
  ): Promise<DailyQuotaDocument | null> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    return this.dailyQuotaModel
      .findOneAndUpdate(
        { userId: userObjectId, date, deletedAt: null },
        { $set: { examsCreated: 0 } },
        { new: true },
      )
      .exec();
  }

  /**
   * Lấy lịch sử quota của 1 user (sắp xếp date giảm dần)
   */
  async findByUser(userId: string | Types.ObjectId): Promise<DailyQuotaDocument[]> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    return this.dailyQuotaModel
      .find({ userId: userObjectId, deletedAt: null })
      .sort({ date: -1 })
      .exec();
  }

  /**
   * Tìm kiếm có phân trang cho Admin (populate thông tin User)
   */
  async findWithPagination(
    filter: FilterQuery<DailyQuota>,
    sort: Record<string, SortOrder>,
    skip: number,
    limit: number,
  ): Promise<{ items: DailyQuotaDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.dailyQuotaModel
        .find(filter)
        .populate('userId', 'fullName email examQuotaOverride')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.dailyQuotaModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }
}
