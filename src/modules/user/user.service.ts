import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { BaseService } from '@common/base/base.service';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { BusinessException } from '@common/exceptions/business.exception';
import { User } from './entities/user.entity';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadService } from '@modules/upload/upload.service';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly userRepository: UserRepository,
    private readonly uploadService: UploadService,
  ) {
    super(userModel, ErrorCode.USER_NOT_FOUND);
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);

    if (existing) {
      throw new BusinessException(
        ErrorCode.USER_EMAIL_ALREADY_EXISTS,
        HttpStatus.CONFLICT,
        ErrorMessage[ErrorCode.USER_EMAIL_ALREADY_EXISTS],
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.create({
      ...dto,
      password: passwordHash,
      deletedAt: null,
    });
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    return this.update(id, dto);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findByGoogleId(googleId);
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.getProfile(userId);
    const oldAvatar = user.avatar;

    const updateData: Partial<User> = {
      fullName: dto.fullName.trim(),
    };

    if (dto.avatar !== undefined) {
      updateData.avatar = dto.avatar;
    }

    const updatedUser = await this.update(userId, updateData);

    if (dto.avatar !== undefined && oldAvatar && oldAvatar !== dto.avatar) {
      await this.uploadService.deleteFileByUrl(oldAvatar);
    }

    return updatedUser;
  }

  /**
   * Tải ảnh lên Cloudflare R2 và cập nhật avatar cho người dùng (xoá ảnh cũ nếu có)
   */
  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<string> {
    const user = await this.getProfile(userId);
    const oldAvatar = user.avatar;

    const uploaded = await this.uploadService.uploadSingleImage(file, { folder: 'avatars' });

    await this.update(userId, {
      avatar: uploaded.url,
    });

    if (oldAvatar && oldAvatar !== uploaded.url) {
      await this.uploadService.deleteFileByUrl(oldAvatar);
    }

    return uploaded.url;
  }

  /**
   * Xoá avatar của người dùng (xoá trên R2 và đặt lại null trong DB)
   */
  async removeAvatar(userId: string): Promise<void> {
    const user = await this.getProfile(userId);
    const oldAvatar = user.avatar;

    await this.update(userId, {
      avatar: undefined,
    });

    if (oldAvatar) {
      await this.uploadService.deleteFileByUrl(oldAvatar);
    }
  }

  async changePassword(id: string, newPassword: string): Promise<User> {
    return this.update(id, {
      password: newPassword,
      tokenValidAfter: new Date(),
    });
  }

  async changeUserPassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    if (!user.password) {
      throw new BusinessException(
        ErrorCode.AUTH_PASSWORD_NOT_SET,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.AUTH_PASSWORD_NOT_SET],
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BusinessException(
        ErrorCode.INVALID_OLD_PASSWORD,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.INVALID_OLD_PASSWORD],
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.update(userId, {
      password: newHash,
      tokenValidAfter: new Date(),
    });
  }
}
