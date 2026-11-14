import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DEFAULT_SYSTEM_CONFIG,
  GLOBAL_CONFIG_ID,
  SystemConfig,
} from './entities/system-config.entity';

@Injectable()
export class SystemConfigRepository {
  constructor(
    @InjectModel(SystemConfig.name)
    private readonly systemConfigModel: Model<SystemConfig>,
  ) { }

  /**
   * Lấy cấu hình hệ thống (nếu chưa có thì tự động khởi tạo bản ghi 'global' mặc định)
   */
  async getOrInitConfig(): Promise<SystemConfig> {
    let config = await this.systemConfigModel
      .findById(GLOBAL_CONFIG_ID)
      .populate('updatedBy', '_id fullName email')
      .lean()
      .exec();

    if (!config) {
      try {
        await this.systemConfigModel.create({
          ...DEFAULT_SYSTEM_CONFIG,
          updatedBy: null,
        });
      } catch (err: any) {
        if (err?.code !== 11000) {
          throw err;
        }
      }

      config = await this.systemConfigModel
        .findById(GLOBAL_CONFIG_ID)
        .populate('updatedBy', '_id fullName email')
        .lean()
        .exec();
    }

    return config as unknown as SystemConfig;
  }

  /**
   * Cập nhật một hoặc nhiều trường cấu hình hệ thống
   */
  async updateConfig(
    updateData: Partial<SystemConfig>,
    adminUserId: string,
  ): Promise<SystemConfig> {
    const config = await this.systemConfigModel
      .findOneAndUpdate(
        { _id: GLOBAL_CONFIG_ID },
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
            updatedBy: new Types.ObjectId(adminUserId),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .populate('updatedBy', '_id fullName email')
      .lean()
      .exec();

    return config as unknown as SystemConfig;
  }
}
