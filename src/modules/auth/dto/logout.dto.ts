import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({
    description: 'Refresh token (tùy chọn nếu đã gửi qua cookie httpOnly)',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
