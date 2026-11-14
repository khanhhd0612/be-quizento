import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { createSchemaOptions } from '@/database/entities/base.entity';

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetToken>;

@Schema(
  createSchemaOptions('password_reset_tokens', {
    timestamps: { createdAt: true, updatedAt: false },
  }),
)
export class PasswordResetToken {
  id: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId?: string | Types.ObjectId | null;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  usedAt?: Date | null;

  createdAt?: Date;
}

export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetToken);
PasswordResetTokenSchema.index({ email: 1, createdAt: 1 });
