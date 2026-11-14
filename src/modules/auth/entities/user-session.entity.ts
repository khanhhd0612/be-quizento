import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { createSchemaOptions } from '@/database/entities/base.entity';

export type UserSessionDocument = HydratedDocument<UserSession>;

@Schema(createSchemaOptions('user_sessions'))
export class UserSession {
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: string | Types.ObjectId;

  @Prop({ required: true, unique: true })
  jti: string;

  @Prop({ type: String, default: null })
  userAgent?: string;

  @Prop({ type: String, default: null })
  ip?: string;

  @Prop({ type: String, default: null })
  deviceName?: string;

  @Prop({ default: () => new Date() })
  lastUsedAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSessionSchema = SchemaFactory.createForClass(UserSession);
UserSessionSchema.index({ userId: 1, revokedAt: 1 });
