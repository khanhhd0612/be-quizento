import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionMediaType } from '../enums/exam.enum';

export class UploadQuestionMediaDto {
  @ApiProperty({
    enum: [QuestionMediaType.IMAGE, QuestionMediaType.AUDIO],
    example: QuestionMediaType.AUDIO,
    description: 'Loại media (image hoặc audio)',
  })
  @IsNotEmpty({ message: 'Loại media không được để trống' })
  @IsEnum([QuestionMediaType.IMAGE, QuestionMediaType.AUDIO], {
    message: 'type phải là image hoặc audio',
  })
  type: QuestionMediaType;

  @ApiPropertyOptional({
    example: 60,
    description: 'Thời lượng audio tính bằng giây (nếu có)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'durationSeconds phải là số' })
  durationSeconds?: number;
}

export class QuestionMediaResponseDto {
  @ApiProperty({
    example: 'https://cdn.example.com/exams/audio-123.mp3',
    description: 'Đường dẫn công khai của file media',
  })
  url: string;

  @ApiProperty({
    example: 2048510,
    description: 'Dung lượng file tính theo byte',
  })
  sizeBytes: number;

  @ApiProperty({
    enum: [QuestionMediaType.IMAGE, QuestionMediaType.AUDIO],
    example: QuestionMediaType.AUDIO,
    description: 'Loại media',
  })
  type: QuestionMediaType;
}
