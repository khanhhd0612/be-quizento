import { ApiProperty } from '@nestjs/swagger';

export class UploadedFileDto {
  @ApiProperty({
    description: 'Đường dẫn công khai (Public URL) để truy cập file',
    example: 'https://pub-xxxx.r2.dev/images/2026-10-09/avatar-1234.png',
  })
  url: string;

  @ApiProperty({
    description: 'Key định danh của file trong Cloudflare R2 bucket',
    example: 'images/2026-10-09/avatar-1234.png',
  })
  key: string;

  @ApiProperty({
    description: 'Tên file gốc người dùng tải lên',
    example: 'my-avatar.png',
  })
  filename: string;

  @ApiProperty({
    description: 'MIME type của file',
    example: 'image/png',
  })
  mimetype: string;

  @ApiProperty({
    description: 'Kích thước file theo bytes',
    example: 1048576,
  })
  size: number;

  @ApiProperty({
    description: 'Tên bucket chứa file trên Cloudflare R2',
    example: 'my-r2-bucket',
  })
  bucket: string;
}

export class DeleteFileDto {
  @ApiProperty({
    description: 'Key của file cần xoá trên Cloudflare R2',
    example: 'images/2026-10-09/avatar-1234.png',
  })
  key: string;
}
