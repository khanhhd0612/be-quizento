import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google ID Token (credential) được cấp từ Google Sign-In SDK phía client',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...id_token_string',
  })
  @IsNotEmpty({ message: 'idToken không được để trống' })
  @IsString({ message: 'idToken phải là chuỗi' })
  idToken: string;
}
