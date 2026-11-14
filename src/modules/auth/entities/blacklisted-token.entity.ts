import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { createSchemaOptions } from '@/database/entities/base.entity';

export type BlacklistedTokenDocument = HydratedDocument<BlacklistedToken>;

@Schema(createSchemaOptions('blacklisted_tokens', { timestamps: false }))
export class BlacklistedToken {
  id: string;

  @Prop({ required: true, unique: true })
  jti: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: string | Types.ObjectId;

  @Prop({ required: true })
  expiresAt: Date;
}

export const BlacklistedTokenSchema = SchemaFactory.createForClass(BlacklistedToken);
// TTL index: Tự động xóa document khi tới thời điểm expiresAt
BlacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
