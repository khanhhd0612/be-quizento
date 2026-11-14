import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExamPrivacy, QuestionMediaType } from '../enums/exam.enum';

export class QuestionChoiceDto {
  @ApiProperty({ example: 'A', description: 'Mã đáp án (A, B, C, D...)' })
  @IsNotEmpty({ message: 'Mã đáp án không được để trống' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Nội dung lựa chọn', description: 'Nội dung lựa chọn' })
  @IsNotEmpty({ message: 'Nội dung đáp án không được để trống' })
  @IsString()
  text: string;
}

export class QuestionMediaDto {
  @ApiPropertyOptional({
    enum: QuestionMediaType,
    default: QuestionMediaType.NONE,
    description: 'Loại media (none, image, audio)',
  })
  @IsOptional()
  @IsEnum(QuestionMediaType)
  type?: QuestionMediaType = QuestionMediaType.NONE;

  @ApiPropertyOptional({ description: 'URL file media' })
  @IsOptional()
  @IsString()
  url?: string | null;

  @ApiPropertyOptional({ description: 'Dung lượng file (bytes)' })
  @IsOptional()
  @IsNumber()
  sizeBytes?: number | null;
}

export class CreateExamQuestionDto {
  @ApiPropertyOptional({ description: 'Thứ tự câu hỏi (bắt đầu từ 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiProperty({ description: 'Nội dung câu hỏi' })
  @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống' })
  @IsString()
  content: string;

  @ApiProperty({ type: [QuestionChoiceDto], description: 'Danh sách các lựa chọn đáp án' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionChoiceDto)
  choices: QuestionChoiceDto[];

  @ApiProperty({ example: 'A', description: 'Đáp án đúng (phải khớp với 1 trong choices[].key)' })
  @IsNotEmpty({ message: 'Đáp án đúng không được để trống' })
  @IsString()
  correctAnswerKey: string;

  @ApiPropertyOptional({ description: 'Giải thích chi tiết cho câu hỏi' })
  @IsOptional()
  @IsString()
  explanation?: string | null;

  @ApiPropertyOptional({ description: 'Chủ đề học tập của câu hỏi (gán nhãn)' })
  @IsOptional()
  @IsString()
  topic?: string | null;

  @ApiPropertyOptional({ type: QuestionMediaDto, description: 'Media đính kèm cho câu hỏi' })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionMediaDto)
  media?: QuestionMediaDto;
}

export class CreateExamDto {
  @ApiProperty({
    example: 'Kinh tế vi mô - Chương 3',
    description: 'Tiêu đề đề thi (tối đa 150 ký tự)',
    maxLength: 150,
  })
  @IsOptional()
  title: string;

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
    default: ExamPrivacy.PUBLIC,
    description: 'Quyền riêng tư của đề thi (public hoặc private)',
  })
  @IsOptional()
  @IsEnum(ExamPrivacy)
  privacy?: ExamPrivacy;

  @ApiPropertyOptional({
    default: true,
    description: 'Cho phép làm ở chế độ Thi thử',
  })
  @IsOptional()
  @IsBoolean()
  practiceModeEnabled?: boolean;

  @ApiPropertyOptional({
    default: true,
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
