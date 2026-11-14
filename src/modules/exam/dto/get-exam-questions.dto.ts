import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ExamTakeMode } from '../enums/exam.enum';

export class GetExamQuestionsQueryDto {
  @ApiPropertyOptional({
    enum: ExamTakeMode,
    description: 'Chế độ xem/làm bài: practice (thi thử), exam (làm bài thật)',
  })
  @IsOptional()
  @IsEnum(ExamTakeMode, {
    message: 'mode phải là practice hoặc exam',
  })
  mode?: ExamTakeMode;
}
