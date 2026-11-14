import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity, createSchemaOptions } from '@/database/entities/base.entity';
import { ExamPrivacy, QuestionMediaType } from '../enums/exam.enum';

export type ExamDocument = HydratedDocument<Exam>;

/**
 * Lựa chọn đáp án cho câu hỏi
 */
@Schema({ _id: false })
export class QuestionChoice {
  @Prop({ required: true, trim: true })
  key: string; // A, B, C, D...

  @Prop({ required: true, trim: true })
  text: string;
}

export const QuestionChoiceSchema = SchemaFactory.createForClass(QuestionChoice);

/**
 * File media đính kèm cho câu hỏi
 */
@Schema({ _id: false })
export class QuestionMedia {
  @Prop({
    type: String,
    enum: Object.values(QuestionMediaType),
    default: QuestionMediaType.NONE,
    required: true,
  })
  type: QuestionMediaType;

  @Prop({ type: String, default: null, trim: true })
  url?: string | null;

  @Prop({ type: Number, default: null })
  sizeBytes?: number | null;
}

export const QuestionMediaSchema = SchemaFactory.createForClass(QuestionMedia);

/**
 * Câu hỏi trong đề thi
 */
@Schema({ _id: true, timestamps: false })
export class ExamQuestion {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: String, required: true, trim: true })
  content: string;

  @Prop({ type: [QuestionChoiceSchema], required: true, default: [] })
  choices: QuestionChoice[];

  @Prop({ type: String, required: true, trim: true })
  correctAnswerKey: string;

  @Prop({ type: String, default: null, trim: true })
  explanation?: string | null;

  @Prop({ type: String, default: null, trim: true })
  topic?: string | null;

  @Prop({
    type: QuestionMediaSchema,
    default: () => ({
      type: QuestionMediaType.NONE,
      url: null,
      sizeBytes: null,
    }),
  })
  media: QuestionMedia;

  @Prop({ type: Number, default: 0, required: true })
  wrongCount: number;

  @Prop({ type: Number, default: 0, required: true })
  answeredCount: number;
}

export const ExamQuestionSchema = SchemaFactory.createForClass(ExamQuestion);

/**
 * Thống kê đề thi (Denormalized)
 */
@Schema({ _id: false })
export class ExamStats {
  @Prop({ type: Number, default: 0, required: true })
  attemptCount: number;

  @Prop({ type: Number, default: 0, required: true })
  avgScore: number;

  @Prop({ type: Number, default: 0, required: true })
  avgRating: number;

  @Prop({ type: Number, default: 0, required: true })
  ratingCount: number;
}

export const ExamStatsSchema = SchemaFactory.createForClass(ExamStats);

/**
 * Thực thể Đề thi (Exam)
 */
@Schema(createSchemaOptions('exams'))
export class Exam extends BaseEntity {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, default: null, trim: true })
  coverUrl?: string | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ExamPrivacy),
    default: ExamPrivacy.PUBLIC,
    required: true,
  })
  privacy: ExamPrivacy;

  @Prop({ type: Boolean, default: true, required: true })
  practiceModeEnabled: boolean;

  @Prop({ type: Boolean, default: true, required: true })
  examModeEnabled: boolean;

  @Prop({ type: Number, default: 0, required: true })
  totalQuestions: number;

  @Prop({
    type: Number,
    default: 0,
    required: true,
  })
  totalMediaSizeBytes: number;

  @Prop({
    type: ExamStatsSchema,
    default: () => ({
      attemptCount: 0,
      avgScore: 0,
      avgRating: 0,
      ratingCount: 0,
    }),
  })
  stats: ExamStats;

  @Prop({ type: [ExamQuestionSchema], default: [] })
  questions: ExamQuestion[];
}

export const ExamSchema = SchemaFactory.createForClass(Exam);

ExamSchema.index({ title: 'text' });
ExamSchema.index({ tags: 1 });
ExamSchema.index({ createdBy: 1 });
ExamSchema.index({ createdAt: -1 });
ExamSchema.index({ privacy: 1, createdAt: -1 });
ExamSchema.index({ deletedAt: 1 });

// Ràng buộc nghiệp vụ: Bắt buộc ≥ 1 chế độ được bật
ExamSchema.pre('validate', function (next) {
  if (!this.practiceModeEnabled && !this.examModeEnabled) {
    return next(
      new Error(
        'Đề thi phải bật ít nhất 1 chế độ: Thi thử (practiceModeEnabled) hoặc Làm bài thật (examModeEnabled)',
      ),
    );
  }
  next();
});
