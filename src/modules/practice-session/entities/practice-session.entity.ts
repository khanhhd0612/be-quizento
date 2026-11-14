import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity, createSchemaOptions } from '@/database/entities/base.entity';
import { ExamTakeMode } from '@modules/exam/enums/exam.enum';
import { PracticeSessionStatus } from '../enums/practice-session.enum';

export type PracticeSessionDocument = HydratedDocument<PracticeSession>;

/**
 * Chi tiết điểm số của lượt làm bài
 */
@Schema({ _id: false })
export class PracticeSessionScore {
  @Prop({ type: Number, required: true, default: 0 })
  correct: number;

  @Prop({ type: Number, required: true, default: 0 })
  total: number;
}

export const PracticeSessionScoreSchema = SchemaFactory.createForClass(PracticeSessionScore);

/**
 * Chi tiết câu trả lời của người dùng trong lượt làm
 */
@Schema({ _id: false })
export class PracticeSessionAnswer {
  @Prop({ type: Types.ObjectId, required: true })
  questionId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  selectedKey: string;

  @Prop({ type: Boolean, required: true })
  isCorrect: boolean;

  @Prop({ type: Date, required: true, default: () => new Date() })
  answeredAt: Date;
}

export const PracticeSessionAnswerSchema = SchemaFactory.createForClass(PracticeSessionAnswer);

/**
 * Thực thể Lượt làm bài (PracticeSession)
 * Collection: practiceSessions
 */
@Schema(createSchemaOptions('practiceSessions'))
export class PracticeSession extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ExamTakeMode),
    required: true,
  })
  mode: ExamTakeMode;

  @Prop({ type: Number, required: true, default: 1 })
  roundNumber: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'PracticeSession',
    default: null,
  })
  parentSessionId?: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], default: [] })
  questionIds?: Types.ObjectId[];

  @Prop({ type: Date, required: true, default: () => new Date() })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  finishedAt?: Date | null;

  @Prop({
    type: PracticeSessionScoreSchema,
    required: true,
    default: () => ({ correct: 0, total: 0 }),
  })
  score: PracticeSessionScore;

  @Prop({ type: [PracticeSessionAnswerSchema], default: [] })
  answers: PracticeSessionAnswer[];

  @Prop({
    type: String,
    enum: Object.values(PracticeSessionStatus),
    required: true,
    default: PracticeSessionStatus.IN_PROGRESS,
  })
  status: PracticeSessionStatus;

  @Prop({ type: Boolean, default: false })
  isOfficial?: boolean;
}

export const PracticeSessionSchema = SchemaFactory.createForClass(PracticeSession);

PracticeSessionSchema.index({ examId: 1, userId: 1 });
PracticeSessionSchema.index({ userId: 1, examId: 1 });
PracticeSessionSchema.index({ userId: 1, createdAt: -1 });
PracticeSessionSchema.index({ deletedAt: 1 });
