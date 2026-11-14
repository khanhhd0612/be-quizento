import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token (chỉ trả về trong body nếu không dùng cookie httpOnly)',
    required: false,
  })
  refreshToken?: string;
}
