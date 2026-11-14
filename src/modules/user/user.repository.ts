import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { User } from './entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel
      .findOne({ email, deletedAt: null })
      .lean({ virtuals: true })
      .exec() as Promise<User | null>;
  }

  async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    return this.userModel
      .findOne({ _id: id, deletedAt: null })
      .lean({ virtuals: true })
      .exec() as Promise<User | null>;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    if (!googleId) return null;
    return this.userModel
      .findOne({ googleId, deletedAt: null })
      .lean({ virtuals: true })
      .exec() as Promise<User | null>;
  }
}
