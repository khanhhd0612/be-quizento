import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { SuccessMessage } from '@common/constants/success-message.constant';
import { DailyQuotaService } from './daily-quota.service';
import { QueryAdminQuotasDto } from './dto/query-admin-quotas.dto';
import { UpdateQuotaOverrideDto } from './dto/update-quota-override.dto';

@ApiTags('Daily Quota')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DailyQuotaController {
  constructor(private readonly dailyQuotaService: DailyQuotaService) {}

  @Get('users/me/quota')
  @ApiOperation({
    summary: 'User xem số đề đã tạo hôm nay / giới hạn còn lại',
    description:
      'Lấy thông tin quota trong ngày của người dùng hiện tại (số đề đã tạo, giới hạn, số lượt còn lại, thời điểm reset).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin quota thành công',
    schema: {
      example: {
        date: '2026-10-10',
        examsCreated: 2,
        limit: 5,
        remaining: 3,
        resetAt: '2026-10-11T00:00:00Z',
      },
    },
  })
  async getMyQuota(@CurrentUser() user: { sub: string }) {
    const result = await this.dailyQuotaService.getMeQuota(user.sub);
    return {
      message: SuccessMessage.QUOTA_GET_MY_SUCCESS,
      data: result,
      ...result,
    };
  }

  @Get('admin/quotas')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin xem danh sách quota đã dùng của user theo ngày (phân trang)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách quota thành công' })
  @ApiResponse({ status: 403, description: 'Yêu cầu quyền Admin' })
  async getAdminQuotas(@Query() query: QueryAdminQuotasDto) {
    const result = await this.dailyQuotaService.getAdminQuotas(query);
    return {
      message: SuccessMessage.QUOTA_GET_ADMIN_LIST_SUCCESS,
      data: result.data,
      pagination: result.pagination,
      meta: result.pagination,
    };
  }

  @Get('admin/quotas/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin xem lịch sử quota đã dùng của 1 user cụ thể',
  })
  @ApiParam({ name: 'userId', description: 'ID người dùng (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Lấy lịch sử quota thành công' })
  @ApiResponse({ status: 404, description: 'QUOTA_RECORD_NOT_FOUND - Không tìm thấy bản ghi' })
  async getUserQuotaHistory(@Param('userId') userId: string) {
    const result = await this.dailyQuotaService.getUserQuotaHistory(userId);
    return {
      message: SuccessMessage.QUOTA_GET_USER_HISTORY_SUCCESS,
      data: result,
    };
  }

  @Patch('admin/users/:userId/quota-override')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin set/gỡ quota riêng cho 1 user (ghi vào users.examQuotaOverride)',
  })
  @ApiParam({ name: 'userId', description: 'ID người dùng (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Cập nhật quota riêng thành công' })
  @ApiResponse({ status: 400, description: 'INVALID_QUOTA_OVERRIDE - Giá trị không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async updateQuotaOverride(@Param('userId') userId: string, @Body() dto: UpdateQuotaOverrideDto) {
    const result = await this.dailyQuotaService.updateUserQuotaOverride(userId, dto);
    return {
      message: SuccessMessage.QUOTA_UPDATE_OVERRIDE_SUCCESS,
      data: result,
    };
  }

  @Delete('admin/quotas/:userId/:date')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset thủ công quota đã dùng của user trong 1 ngày cụ thể (ân xá, examsCreated = 0)',
  })
  @ApiParam({ name: 'userId', description: 'ID người dùng (ObjectId)' })
  @ApiParam({
    name: 'date',
    description: 'Ngày áp dụng quota (định dạng YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Reset quota thành công' })
  @ApiResponse({ status: 404, description: 'QUOTA_RECORD_NOT_FOUND - Không tìm thấy bản ghi' })
  async resetQuota(@Param('userId') userId: string, @Param('date') date: string) {
    const result = await this.dailyQuotaService.resetUserQuota(userId, date);
    return {
      message: SuccessMessage.QUOTA_RESET_SUCCESS,
      data: result,
    };
  }
}
