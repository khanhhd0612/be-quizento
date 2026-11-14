import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { SubmitSessionAnswerDto } from './submit-session-answer.dto';

export class SubmitSessionDto {
  @ApiPropertyOptional({
    description: 'Danh sách các câu trả lời khi nộp batch',
    type: [SubmitSessionAnswerDto],
  })
  @IsOptional()
  @IsArray({ message: 'answers phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => SubmitSessionAnswerDto)
  answers?: SubmitSessionAnswerDto[];
}
