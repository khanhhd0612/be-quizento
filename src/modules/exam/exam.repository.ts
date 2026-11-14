import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types, isValidObjectId } from 'mongoose';
import { Exam, QuestionMedia } from './entities/exam.entity';
import { QuestionMediaType } from './enums/exam.enum';

@Injectable()
export class ExamRepository {
  constructor(@InjectModel(Exam.name) private readonly examModel: Model<Exam>) {}

  /**
   * Truy vấn danh sách đề thi (phân trang, sắp xếp, loại trừ trường questions để trả về metadata)
   */
  async findWithPagination(
    filter: FilterQuery<Exam>,
    sort: Record<string, SortOrder>,
    skip: number,
    limit: number,
  ): Promise<{ items: Exam[]; total: number }> {
    const [items, total] = await Promise.all([
      this.examModel
        .find(filter)
        .select('-questions')
        .populate('createdBy', 'fullName avatar email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true })
        .exec(),
      this.examModel.countDocuments(filter).exec(),
    ]);

    return { items: items as unknown as Exam[], total };
  }

  /**
   * Lấy chi tiết metadata 1 đề thi (loại trừ nội dung câu hỏi)
   */
  async findMetadataById(id: string): Promise<Exam | null> {
    if (!isValidObjectId(id)) return null;

    return this.examModel
      .findOne({ _id: id, deletedAt: null })
      .select('-questions')
      .populate('createdBy', 'fullName avatar email')
      .lean({ virtuals: true })
      .exec() as Promise<Exam | null>;
  }

  /**
   * Tìm đề thi theo ID (kèm đầy đủ câu hỏi)
   */
  async findById(id: string): Promise<Exam | null> {
    if (!isValidObjectId(id)) return null;

    return this.examModel
      .findOne({ _id: id, deletedAt: null })
      .lean({ virtuals: true })
      .exec() as Promise<Exam | null>;
  }

  /**
   * Tạo mới một đề thi
   */
  async create(data: Partial<Exam>): Promise<Exam> {
    const created = await this.examModel.create(data);
    return created.toObject ? (created.toObject() as Exam) : (created as unknown as Exam);
  }

  /**
   * Cập nhật thông tin đề thi
   */
  async update(id: string, updateData: Partial<Exam>): Promise<Exam | null> {
    if (!isValidObjectId(id)) return null;

    return this.examModel
      .findOneAndUpdate({ _id: id, deletedAt: null }, { $set: updateData }, { new: true })
      .lean({ virtuals: true })
      .exec() as Promise<Exam | null>;
  }

  /**
   * Xoá mềm đề thi (set deletedAt)
   */
  async softDelete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;

    const result = await this.examModel
      .updateOne({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date() } })
      .exec();

    return result.modifiedCount > 0;
  }

  /**
   * Đếm số lượng đề thi user đã tạo từ mốc startOfDay
   */
  async countCreatedTodayByUser(userId: string, startOfDay: Date): Promise<number> {
    if (!isValidObjectId(userId)) return 0;

    return this.examModel
      .countDocuments({
        createdBy: new Types.ObjectId(userId),
        createdAt: { $gte: startOfDay },
      })
      .exec();
  }

  /**
   * Cập nhật media cho 1 câu hỏi và cập nhật tổng dung lượng media đề thi
   */
  async updateQuestionMedia(
    examId: string,
    questionId: string,
    media: QuestionMedia,
    newTotalMediaSizeBytes: number,
  ): Promise<Exam | null> {
    if (!isValidObjectId(examId) || !isValidObjectId(questionId)) return null;

    return this.examModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(examId),
          'questions._id': new Types.ObjectId(questionId),
          deletedAt: null,
        },
        {
          $set: {
            'questions.$.media': media,
            totalMediaSizeBytes: newTotalMediaSizeBytes,
          },
        },
        { new: true },
      )
      .lean({ virtuals: true })
      .exec() as Promise<Exam | null>;
  }

  /**
   * Xoá media khỏi 1 câu hỏi và cập nhật lại tổng dung lượng media đề thi
   */
  async removeQuestionMedia(
    examId: string,
    questionId: string,
    newTotalMediaSizeBytes: number,
  ): Promise<Exam | null> {
    if (!isValidObjectId(examId) || !isValidObjectId(questionId)) return null;

    return this.examModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(examId),
          'questions._id': new Types.ObjectId(questionId),
          deletedAt: null,
        },
        {
          $set: {
            'questions.$.media': {
              type: QuestionMediaType.NONE,
              url: null,
              sizeBytes: null,
            },
            totalMediaSizeBytes: newTotalMediaSizeBytes,
          },
        },
        { new: true },
      )
      .lean({ virtuals: true })
      .exec() as Promise<Exam | null>;
  }
}
