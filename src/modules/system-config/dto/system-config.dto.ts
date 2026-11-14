import { ApiProperty } from '@nestjs/swagger';

export class PublicConfigResponseDto {
  @ApiProperty({ example: 2097152, description: 'Giới hạn dung lượng ảnh (bytes)' })
  maxImageSizeBytes: number;

  @ApiProperty({ example: 5242880, description: 'Giới hạn dung lượng audio (bytes)' })
  maxAudioSizeBytes: number;

  @ApiProperty({ example: 120, description: 'Giới hạn thời lượng audio (giây)' })
  maxAudioDurationSeconds: number;

  @ApiProperty({
    example: 52428800,
    description: 'Tổng dung lượng media tối đa trên mỗi đề thi (bytes)',
  })
  maxTotalMediaSizePerExam: number;

  @ApiProperty({ example: 10, description: 'Số câu tối đa khách được xem preview' })
  guestPreviewMaxQuestions: number;

  @ApiProperty({ example: 0.5, description: '% tối đa khách được xem preview' })
  guestPreviewMaxPercent: number;
}

export class ConfigUpdatedByDto {
  @ApiProperty({ example: '6523abc...', description: 'ID người cập nhật' })
  _id: string;

  @ApiProperty({ example: 'Admin Nguyễn', description: 'Tên người cập nhật' })
  fullName: string;
}

export class AdminConfigResponseDto extends PublicConfigResponseDto {
  @ApiProperty({ example: 5, description: 'Số đề/ngày mặc định cho user mới' })
  defaultDailyExamQuota: number;

  @ApiProperty({ example: '2026-10-01T08:00:00Z', description: 'Thời điểm cập nhật gần nhất' })
  updatedAt: Date;

  @ApiProperty({ type: ConfigUpdatedByDto, nullable: true, description: 'Người cập nhật gần nhất' })
  updatedBy: ConfigUpdatedByDto | null;
}
