import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination.dto';
import { ExamTakeMode } from '@modules/exam/enums/exam.enum';
import { PracticeSessionStatus } from '../enums/practice-session.enum';

export class QueryUserSessionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo ID đề thi',
  })
  @IsOptional()
  @IsMongoId({ message: 'examId phải là ObjectId hợp lệ' })
  examId?: string;

  @ApiPropertyOptional({
    enum: ExamTakeMode,
    description: 'Lọc theo chế độ làm bài (practice | exam)',
  })
  @IsOptional()
  @IsEnum(ExamTakeMode, { message: 'Chế độ làm bài không hợp lệ' })
  mode?: ExamTakeMode;

  @ApiPropertyOptional({
    enum: PracticeSessionStatus,
    description: 'Lọc theo trạng thái lượt làm (in_progress | completed)',
  })
  @IsOptional()
  @IsEnum(PracticeSessionStatus, { message: 'Trạng thái lượt làm không hợp lệ' })
  status?: PracticeSessionStatus;
}
