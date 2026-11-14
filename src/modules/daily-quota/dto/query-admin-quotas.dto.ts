import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class QueryAdminQuotasDto {
  @ApiPropertyOptional({
    example: '2026-10-10',
    description: 'Lọc theo ngày (YYYY-MM-DD), mặc định là ngày hôm nay',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Định dạng ngày phải là YYYY-MM-DD',
  })
  date?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Lọc user dùng từ X đề trở lên trong ngày',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minUsed phải là số nguyên' })
  @Min(0, { message: 'minUsed không được âm' })
  minUsed?: number;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    description: 'Trang hiện tại',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Số bản ghi mỗi trang',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
