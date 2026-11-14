import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token (tùy chọn nếu đã gửi qua cookie httpOnly)',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
