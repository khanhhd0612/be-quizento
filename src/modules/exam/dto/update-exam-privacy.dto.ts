import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ExamPrivacy } from '../enums/exam.enum';

export class UpdateExamPrivacyDto {
  @ApiProperty({
    enum: ExamPrivacy,
    example: ExamPrivacy.PRIVATE,
    description: 'Quyền riêng tư mới (public hoặc private)',
  })
  @IsNotEmpty({ message: 'Quyền riêng tư không được để trống' })
  @IsEnum(ExamPrivacy, { message: 'Quyền riêng tư phải là public hoặc private' })
  privacy: ExamPrivacy;
}
