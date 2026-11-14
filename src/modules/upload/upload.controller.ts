import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { multerImageOptions } from '@common/utils/multer.util';
import { multerAudioOptions } from '@common/utils/audio.util';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';
import { SuccessMessage } from '@common/constants/success-message.constant';
import { UploadService } from './upload.service';
import { DeleteFileDto, UploadedFileDto } from './dto/upload-response.dto';

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({
    summary: 'Tải một file ảnh lên Cloudflare R2',
    description:
      'Chấp nhận các định dạng: jpg, jpeg, png, webp, gif, svg. Dung lượng tối đa: theo MAX_FILE_SIZE (mặc định 5MB).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Thư mục phân loại trong bucket (mặc định: images)',
    example: 'avatars',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh cần tải lên',
        },
        folder: {
          type: 'string',
          description: 'Thư mục phân loại trong bucket',
          example: 'avatars',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tải ảnh lên Cloudflare R2 thành công',
    type: UploadedFileDto,
  })
  @UseInterceptors(FileInterceptor('file', multerImageOptions))
  async uploadSingleImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') queryFolder?: string,
    @Body('folder') bodyFolder?: string,
  ) {
    if (!file) {
      throw new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST);
    }

    const folder = queryFolder || bodyFolder || 'images';
    const result = await this.uploadService.uploadSingleImage(file, { folder });

    return {
      message: SuccessMessage.UPLOAD_IMAGE_SUCCESS,
      data: result,
    };
  }

  @Post('audio')
  @ApiOperation({
    summary: 'Tải một file audio lên Cloudflare R2',
    description: 'Chấp nhận các định dạng: mp3. Dung lượng tối đa: theo cấu hình (mặc định 5MB).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Thư mục phân loại trong bucket (mặc định: audio)',
    example: 'exams',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File audio cần tải lên',
        },
        folder: {
          type: 'string',
          description: 'Thư mục phân loại trong bucket',
          example: 'audio',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tải audio lên Cloudflare R2 thành công',
    type: UploadedFileDto,
  })
  @UseInterceptors(FileInterceptor('file', multerAudioOptions))
  async uploadSingleAudio(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') queryFolder?: string,
    @Body('folder') bodyFolder?: string,
  ) {
    if (!file) {
      throw new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST);
    }

    const folder = queryFolder || bodyFolder || 'audio';
    const result = await this.uploadService.uploadSingleAudio(file, { folder });

    return {
      message: SuccessMessage.UPLOAD_AUDIO_SUCCESS,
      data: result,
    };
  }

  @Post('images')
  @ApiOperation({
    summary: 'Tải nhiều file ảnh lên Cloudflare R2 cùng lúc',
    description:
      'Chấp nhận tối đa 10 ảnh một lần tải. Dung lượng mỗi file: theo MAX_FILE_SIZE (mặc định 5MB).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Thư mục phân loại trong bucket (mặc định: images)',
    example: 'gallery',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Danh sách các file ảnh cần tải lên',
        },
        folder: {
          type: 'string',
          description: 'Thư mục phân loại trong bucket',
          example: 'gallery',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tải các ảnh lên Cloudflare R2 thành công',
    type: [UploadedFileDto],
  })
  @UseInterceptors(FilesInterceptor('files', 10, multerImageOptions))
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') queryFolder?: string,
    @Body('folder') bodyFolder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BusinessException(ErrorCode.FILE_NOT_FOUND, HttpStatus.BAD_REQUEST);
    }

    const folder = queryFolder || bodyFolder || 'images';
    const result = await this.uploadService.uploadMultipleImages(files, { folder });

    return {
      message: SuccessMessage.UPLOAD_IMAGES_SUCCESS,
      data: result,
    };
  }

  @Delete()
  @ApiOperation({
    summary: 'Xoá một file ảnh trên Cloudflare R2 theo key',
  })
  @ApiResponse({
    status: 200,
    description: 'Xoá file thành công',
  })
  async deleteImage(@Body() dto: DeleteFileDto) {
    await this.uploadService.deleteImage(dto.key);

    return {
      message: SuccessMessage.DELETE_FILE_SUCCESS,
    };
  }
}
