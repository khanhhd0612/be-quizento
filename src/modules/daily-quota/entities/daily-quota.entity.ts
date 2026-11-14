import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity, createSchemaOptions } from '@/database/entities/base.entity';

export type DailyQuotaDocument = HydratedDocument<DailyQuota>;

export const DAILY_QUOTA_RETENTION_DAYS = 90;

/**
 * Thực thể Theo dõi Quota tạo đề hàng ngày của người dùng (DailyQuota)
 * Collection: dailyQuotas
 */
@Schema(createSchemaOptions('dailyQuotas'))
export class DailyQuota extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  date: string; // Định dạng YYYY-MM-DD

  @Prop({ type: Number, required: true, default: 0 })
  examsCreated: number;

  @Prop({
    type: Date,
    default: () => {
      const d = new Date();
      d.setDate(d.getDate() + DAILY_QUOTA_RETENTION_DAYS);
      return d;
    },
  })
  expiresAt: Date;
}

export const DailyQuotaSchema = SchemaFactory.createForClass(DailyQuota);

DailyQuotaSchema.index({ userId: 1, date: 1 }, { unique: true });
DailyQuotaSchema.index({ date: 1 });
DailyQuotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
DailyQuotaSchema.index({ deletedAt: 1 });
