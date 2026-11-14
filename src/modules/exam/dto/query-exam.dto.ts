import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { ExamSortOption } from '../enums/exam.enum';

export class QueryExamDto {
  @ApiPropertyOptional({ description: 'Tìm theo title hoặc tags' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo tag (phân cách bằng dấu phẩy, ví dụ: toan,grade12)',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    enum: ExamSortOption,
    default: ExamSortOption.NEWEST,
    description: 'Sắp xếp danh sách: newest, popular, rating. Mặc định: newest',
  })
  @IsOptional()
  @IsEnum(ExamSortOption)
  sort: ExamSortOption = ExamSortOption.NEWEST;

  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Trang hiện tại' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 50,
    description: 'Số item mỗi trang (mặc định 20, tối đa 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Lọc theo ID người tạo (ObjectId)' })
  @IsOptional()
  @IsMongoId({ message: 'createdBy phải là ObjectId hợp lệ' })
  createdBy?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
