import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, isValidObjectId } from 'mongoose';
import { PracticeSession, PracticeSessionDocument } from './entities/practice-session.entity';

@Injectable()
export class PracticeSessionRepository {
  constructor(
    @InjectModel(PracticeSession.name)
    private readonly practiceSessionModel: Model<PracticeSessionDocument>,
  ) {}

  /**
   * Tạo lượt làm bài mới
   */
  async create(data: Partial<PracticeSession>): Promise<PracticeSessionDocument> {
    return this.practiceSessionModel.create(data);
  }

  /**
   * Tìm session theo ID (trả về Document để thao tác save/update)
   */
  async findById(id: string): Promise<PracticeSessionDocument | null> {
    if (!isValidObjectId(id)) return null;

    return this.practiceSessionModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  /**
   * Cập nhật thông tin session
   */
  async update(id: string, updateData: Partial<PracticeSession>): Promise<PracticeSession | null> {
    if (!isValidObjectId(id)) return null;

    return this.practiceSessionModel
      .findOneAndUpdate({ _id: id, deletedAt: null }, { $set: updateData }, { new: true })
      .lean({ virtuals: true })
      .exec() as Promise<PracticeSession | null>;
  }

  /**
   * Lấy danh sách session có phân trang
   */
  async findWithPagination(
    filter: FilterQuery<PracticeSession>,
    sort: Record<string, SortOrder>,
    skip: number,
    limit: number,
  ): Promise<{ items: PracticeSession[]; total: number }> {
    const [items, total] = await Promise.all([
      this.practiceSessionModel
        .find(filter)
        .populate('examId', 'title totalQuestions')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true })
        .exec(),
      this.practiceSessionModel.countDocuments(filter).exec(),
    ]);

    return { items: items as unknown as PracticeSession[], total };
  }
}
