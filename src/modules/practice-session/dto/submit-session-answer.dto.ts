import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class SubmitSessionAnswerDto {
  @ApiProperty({
    example: '60d5ec49f1b2c8b1f8e4e1a1',
    description: 'ID của câu hỏi trong đề thi (ObjectId)',
  })
  @IsNotEmpty({ message: 'questionId không được để trống' })
  @IsMongoId({ message: 'questionId phải là ObjectId hợp lệ' })
  questionId: string;

  @ApiProperty({
    example: 'B',
    description: 'Đáp án người dùng chọn (A, B, C, D...)',
  })
  @IsNotEmpty({ message: 'selectedKey không được để trống' })
  @IsString({ message: 'selectedKey phải là chuỗi' })
  selectedKey: string;
}
