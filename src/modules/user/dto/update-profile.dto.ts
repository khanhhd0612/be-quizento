import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên của người dùng, từ 2-50 ký tự',
  })
  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Họ và tên không được vượt quá 50 ký tự' })
  fullName: string;

  @ApiProperty({
    example: 'https://pub-xxxx.r2.dev/avatars/avatar-123.png',
    description: 'Đường dẫn avatar của người dùng',
    required: false,
  })
  avatar?: string;
}
