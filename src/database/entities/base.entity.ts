import { Prop, Schema, SchemaOptions } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Cấu hình SchemaOptions mặc định dùng chung cho mọi entity/schema:
 * - timestamps: true (tự động quản lý createdAt, updatedAt)
 * - toJSON & toObject: tự động map _id thành id, xóa _id và __v khi serialize
 */
export const defaultSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString() ?? ret.id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString() ?? ret.id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

/**
 * Helper tạo SchemaOptions với collection name và cho phép override các options khác.
 */
export function createSchemaOptions(
  collection: string,
  options?: Partial<SchemaOptions>,
): SchemaOptions {
  return {
    ...defaultSchemaOptions,
    collection,
    ...options,
  };
}

/**
 * BaseEntity chứa các trường dùng chung cho các entity nghiệp vụ:
 * - id: khóa chính dạng string (ánh xạ từ MongoDB _id)
 * - deletedAt: thời điểm xóa mềm (soft delete), null nếu chưa xóa
 * - createdAt, updatedAt: mốc thời gian tạo và cập nhật
 */
@Schema()
export abstract class BaseEntity {
  _id: Types.ObjectId;
  id: string;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}
