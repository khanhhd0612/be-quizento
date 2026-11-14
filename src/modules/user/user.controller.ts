import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { multerImageOptions } from '@common/utils/multer.util';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';
import { SuccessMessage } from '@common/constants/success-message.constant';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from '@modules/auth/dto/change-password.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin thành công' })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.userService.getProfile(user.sub);
    return {
      message: SuccessMessage.USER_GET_PROFILE_SUCCESS,
      data: {
        id: profile.id ?? (profile as any)._id?.toString(),
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        avatar: profile.avatar || null,
        authProvider: profile.authProvider || 'local',
        isActive: profile.isActive,
        createdAt: profile.createdAt,
      },
    };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng (hỗ trợ fullName và avatar URL)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin thành công' })
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    const updated = await this.userService.updateProfile(user.sub, dto);
    return {
      message: SuccessMessage.USER_UPDATE_PROFILE_SUCCESS,
      data: {
        id: updated.id ?? (updated as any)._id?.toString(),
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        avatar: updated.avatar || null,
        authProvider: updated.authProvider || 'local',
      },
    };
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Tải lên và cập nhật avatar mới cho người dùng' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh avatar (jpg, jpeg, png, webp, gif, svg)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật avatar thành công' })
  @UseInterceptors(FileInterceptor('file', multerImageOptions))
  async uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST);
    }

    const avatarUrl = await this.userService.uploadAvatar(user.sub, file);
    return {
      message: SuccessMessage.USER_UPDATE_AVATAR_SUCCESS,
      data: {
        avatar: avatarUrl,
      },
    };
  }

  @Patch('avatar')
  @ApiOperation({ summary: 'Cập nhật avatar (alias cho POST /users/avatar)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh avatar',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerImageOptions))
  async patchAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    return this.uploadAvatar(user, file);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Xoá avatar hiện tại của người dùng' })
  @ApiResponse({ status: 200, description: 'Xoá avatar thành công' })
  async deleteAvatar(@CurrentUser() user: any) {
    await this.userService.removeAvatar(user.sub);
    return {
      message: SuccessMessage.USER_DELETE_AVATAR_SUCCESS,
      data: {
        avatar: null,
      },
    };
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Đổi mật khẩu người dùng' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({ status: 400, description: 'Mật khẩu cũ không chính xác' })
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    await this.userService.changeUserPassword(user.sub, dto.oldPassword, dto.newPassword);
    return {
      message: SuccessMessage.AUTH_CHANGE_PASSWORD_SUCCESS,
    };
  }
}
