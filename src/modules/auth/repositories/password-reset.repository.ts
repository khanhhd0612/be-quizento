import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordResetToken } from '../entities/password-reset-token.entity';

@Injectable()
export class PasswordResetRepository {
  constructor(
    @InjectModel(PasswordResetToken.name)
    private readonly passwordResetModel: Model<PasswordResetToken>,
  ) {}

  async countRecentByEmail(email: string, since: Date) {
    return this.passwordResetModel
      .countDocuments({
        email,
        createdAt: { $gte: since },
      })
      .exec();
  }

  async create(data: {
    email: string;
    userId?: string | null;
    tokenHash: string;
    expiresAt: Date;
    usedAt?: Date | null;
  }) {
    const record = await this.passwordResetModel.create(data);
    return record.toObject ? record.toObject() : record;
  }

  async findValidByHash(tokenHash: string) {
    return this.passwordResetModel
      .findOne({
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .lean({ virtuals: true })
      .exec();
  }

  async markUsed(id: string) {
    return this.passwordResetModel.findByIdAndUpdate(id, { usedAt: new Date() }).exec();
  }
}
