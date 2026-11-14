import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlacklistedToken } from '../entities/blacklisted-token.entity';

@Injectable()
export class TokenBlacklistRepository {
  constructor(
    @InjectModel(BlacklistedToken.name)
    private readonly blacklistedTokenModel: Model<BlacklistedToken>,
  ) {}

  async exists(jti: string): Promise<boolean> {
    const record = await this.blacklistedTokenModel.findOne({ jti }).select('_id').lean().exec();
    return !!record;
  }

  async create(data: { jti: string; userId: string; expiresAt: Date }): Promise<void> {
    await this.blacklistedTokenModel.create(data);
  }
}
