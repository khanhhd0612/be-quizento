import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, ValidateIf } from 'class-validator';

export class UpdateQuotaOverrideDto {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 15,
    description: 'Số đề tối đa/ngày riêng do Admin cấp (null = dùng mặc định hệ thống)',
  })
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsInt({ message: 'Giá trị examQuotaOverride phải là số nguyên hoặc null' })
  @Min(0, { message: 'Giá trị examQuotaOverride không được âm' })
  examQuotaOverride: number | null;
}
