import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity, createSchemaOptions } from '@/database/entities/base.entity';

export type UserDocument = HydratedDocument<User>;

/**
 * Đánh giá đề thi người dùng đã thực hiện (chống vote nhiều lần 1 đề)
 */
@Schema({ _id: false })
export class UserRating {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  score: number;

  @Prop({ type: Date, required: true, default: () => new Date() })
  ratedAt: Date;
}

export const UserRatingSchema = SchemaFactory.createForClass(UserRating);

@Schema(createSchemaOptions('users'))
export class User extends BaseEntity {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: false })
  password?: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: () => new Date() })
  tokenValidAfter: Date;

  @Prop({ default: null })
  googleId?: string;

  @Prop({ default: null })
  avatar?: string;

  @Prop({ default: 'local', enum: ['local', 'google'] })
  authProvider?: string;

  /**
   * Quota tạo đề/ngày riêng do Admin set. null = dùng default hệ thống
   */
  @Prop({ type: Number, default: null })
  examQuotaOverride?: number | null;

  /**
   * Danh sách các đề đã vote (chống vote nhiều lần 1 đề)
   */
  @Prop({ type: [UserRatingSchema], default: [] })
  ratingGiven: UserRating[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ deletedAt: 1 });
UserSchema.index({ googleId: 1 }, { sparse: true });
UserSchema.index({ 'ratingGiven.examId': 1 });
