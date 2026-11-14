import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { createSchemaOptions } from '@/database/entities/base.entity';
import { User } from '@modules/user/entities/user.entity';

export type SystemConfigDocument = HydratedDocument<SystemConfig>;

export const GLOBAL_CONFIG_ID = 'global';

export const DEFAULT_SYSTEM_CONFIG = {
  _id: GLOBAL_CONFIG_ID,
  defaultDailyExamQuota: 5,
  maxImageSizeBytes: 2097152, // 2MB
  maxAudioSizeBytes: 5242880, // 5MB
  maxAudioDurationSeconds: 120, // 120s
  maxTotalMediaSizePerExam: 52428800, // 50MB
  guestPreviewMaxQuestions: 10,
  guestPreviewMaxPercent: 0.5,
};

export const MAX_IMAGE_CONFIG_CEILING_BYTES = 20 * 1024 * 1024; // 20MB

@Schema(createSchemaOptions('systemConfig', { _id: false, timestamps: false }))
export class SystemConfig {
  @Prop({ type: String, default: GLOBAL_CONFIG_ID, required: true })
  _id: string;

  @Prop({ type: Number, default: 5, required: true })
  defaultDailyExamQuota: number;

  @Prop({ type: Number, default: 2097152, required: true })
  maxImageSizeBytes: number;

  @Prop({ type: Number, default: 5242880, required: true })
  maxAudioSizeBytes: number;

  @Prop({ type: Number, default: 120, required: true })
  maxAudioDurationSeconds: number;

  @Prop({ type: Number, default: 52428800, required: true })
  maxTotalMediaSizePerExam: number;

  @Prop({ type: Number, default: 10, required: true })
  guestPreviewMaxQuestions: number;

  @Prop({ type: Number, default: 0.5, required: true })
  guestPreviewMaxPercent: number;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt: Date;

  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  updatedBy?: Types.ObjectId | User | null;
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);
