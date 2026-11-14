import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ExamTakeMode } from '@modules/exam/enums/exam.enum';

export class CreatePracticeSessionDto {
  @ApiProperty({
    enum: ExamTakeMode,
    example: ExamTakeMode.PRACTICE,
    description: 'Chế độ làm bài: practice (Thi thử) hoặc exam (Làm bài thật)',
  })
  @IsNotEmpty({ message: 'Chế độ làm bài không được để trống' })
  @IsEnum(ExamTakeMode, { message: 'Chế độ làm bài phải là practice hoặc exam' })
  mode: ExamTakeMode;
}
