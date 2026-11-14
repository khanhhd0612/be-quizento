import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { UserSession } from '../entities/user-session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectModel(UserSession.name)
    private readonly sessionModel: Model<UserSession>,
  ) {}

  async create(data: {
    userId: string;
    jti: string;
    userAgent?: string;
    ip?: string;
    deviceName?: string;
    expiresAt: Date;
  }) {
    const session = await this.sessionModel.create({
      ...data,
      revokedAt: null,
    });
    return session.toObject ? session.toObject() : session;
  }

  async findActiveByUser(userId: string) {
    return this.sessionModel
      .find({
        userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastUsedAt: -1 })
      .lean({ virtuals: true })
      .exec();
  }

  async findById(id: string) {
    if (!isValidObjectId(id)) return null;
    return this.sessionModel.findById(id).lean({ virtuals: true }).exec();
  }

  async revoke(id: string) {
    return this.sessionModel.findByIdAndUpdate(id, { revokedAt: new Date() }).exec();
  }

  async revokeByJti(jti: string) {
    return this.sessionModel.updateMany({ jti }, { revokedAt: new Date() }).exec();
  }

  async revokeAllExcept(userId: string, exceptJti: string) {
    return this.sessionModel
      .updateMany({ userId, jti: { $ne: exceptJti }, revokedAt: null }, { revokedAt: new Date() })
      .exec();
  }

  async revokeAll(userId: string) {
    return this.sessionModel
      .updateMany({ userId, revokedAt: null }, { revokedAt: new Date() })
      .exec();
  }
}
