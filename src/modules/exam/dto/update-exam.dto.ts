import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ExamPrivacy } from '../enums/exam.enum';
import { CreateExamQuestionDto } from './create-exam.dto';

export class UpdateExamDto {
  @ApiPropertyOptional({
    example: 'Kinh tế vi mô - Chương 3',
    description: 'Tiêu đề đề thi (tối đa 150 ký tự)',
    maxLength: 150,
  })
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'https://pub-r2.example.com/images/cover.jpg',
    description: 'URL ảnh đại diện / ảnh bìa của đề thi',
  })
  @IsOptional()
  @IsString()
  coverUrl?: string | null;

  @ApiPropertyOptional({
    example: ['kinhtevimo', 'daihoc'],
    description: 'Danh sách các tag phân loại',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    enum: ExamPrivacy,
    description: 'Quyền riêng tư của đề thi (public hoặc private)',
  })
  @IsOptional()
  @IsEnum(ExamPrivacy)
  privacy?: ExamPrivacy;

  @ApiPropertyOptional({
    description: 'Cho phép làm ở chế độ Thi thử',
  })
  @IsOptional()
  @IsBoolean()
  practiceModeEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Cho phép làm ở chế độ Làm bài thật',
  })
  @IsOptional()
  @IsBoolean()
  examModeEnabled?: boolean;

  @ApiPropertyOptional({
    type: [CreateExamQuestionDto],
    description: 'Danh sách câu hỏi trong đề thi',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExamQuestionDto)
  questions?: CreateExamQuestionDto[];
}
