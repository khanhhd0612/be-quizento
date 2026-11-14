import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { SuccessMessage } from '@common/constants/success-message.constant';
import { SystemConfigService } from './system-config.service';
import { AdminConfigResponseDto, PublicConfigResponseDto } from './dto/system-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@ApiTags('Config')
@Controller()
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('admin/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy toàn bộ cấu hình hệ thống để hiển thị trang quản trị (Admin)',
    description: 'Chỉ dành cho tài khoản Admin có quyền quản trị hệ thống.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy cấu hình quản trị thành công',
    type: AdminConfigResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập (yêu cầu role admin)' })
  async getAdminConfig() {
    const config = await this.systemConfigService.getAdminConfig();
    return {
      message: SuccessMessage.SYSTEM_CONFIG_GET_ADMIN_SUCCESS,
      data: config,
    };
  }

  @Get('config/public')
  @ApiOperation({
    summary: 'Lấy tập con cấu hình cần cho client (Public)',
    description:
      'Không bắt buộc đăng nhập. Trả về các giới hạn file (ảnh, audio, tổng media) và giới hạn guest preview để client validate UX.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy cấu hình public thành công',
    type: PublicConfigResponseDto,
  })
  async getPublicConfig() {
    const config = await this.systemConfigService.getPublicConfig();
    return {
      message: SuccessMessage.SYSTEM_CONFIG_GET_PUBLIC_SUCCESS,
      data: config,
    };
  }

  @Patch('admin/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật một hoặc nhiều trường cấu hình hệ thống (Admin)',
    description:
      'Chỉ gửi field muốn đổi (partial update). Validate nghiêm ngặt quy tắc nghiệp vụ theo bảng mã lỗi chuẩn.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật cấu hình thành công',
    type: AdminConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu cấu hình không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập (yêu cầu role admin)' })
  async updateConfig(@Body() dto: UpdateSystemConfigDto, @CurrentUser() user: { sub: string }) {
    const updated = await this.systemConfigService.updateConfig(dto, user.sub);
    return {
      message: SuccessMessage.SYSTEM_CONFIG_UPDATE_SUCCESS,
      data: updated,
    };
  }
}
