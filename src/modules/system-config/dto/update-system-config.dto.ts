import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateSystemConfigDto {
  @ApiPropertyOptional({
    example: 8,
    description: 'Số đề/ngày mặc định cho user mới (số nguyên dương >= 1)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'defaultDailyExamQuota phải là số' })
  defaultDailyExamQuota?: number;

  @ApiPropertyOptional({
    example: 3145728,
    description: 'Giới hạn dung lượng ảnh (bytes) (số dương, tối đa 20MB)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxImageSizeBytes phải là số' })
  maxImageSizeBytes?: number;

  @ApiPropertyOptional({
    example: 5242880,
    description: 'Giới hạn dung lượng audio (bytes) (số dương)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxAudioSizeBytes phải là số' })
  maxAudioSizeBytes?: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Giới hạn thời lượng audio (giây) (số dương)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxAudioDurationSeconds phải là số' })
  maxAudioDurationSeconds?: number;

  @ApiPropertyOptional({
    example: 52428800,
    description:
      'Tổng dung lượng media tối đa trên mỗi đề thi (bytes) (>= maxImageSizeBytes và >= maxAudioSizeBytes)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'maxTotalMediaSizePerExam phải là số' })
  maxTotalMediaSizePerExam?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Số câu tối đa khách được xem preview (số nguyên dương >= 1)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'guestPreviewMaxQuestions phải là số' })
  guestPreviewMaxQuestions?: number;

  @ApiPropertyOptional({
    example: 0.5,
    description: '% tối đa khách được xem preview (trong khoảng (0, 1])',
  })
  @IsOptional()
  @IsNumber({}, { message: 'guestPreviewMaxPercent phải là số' })
  guestPreviewMaxPercent?: number;
}
