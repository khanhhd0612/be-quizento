import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { SuccessMessage } from '@common/constants/success-message.constant';
import { ExamService } from './exam.service';
import { QueryExamDto } from './dto/query-exam.dto';
import { GetExamQuestionsQueryDto } from './dto/get-exam-questions.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateExamPrivacyDto } from './dto/update-exam-privacy.dto';
import { QuestionMediaResponseDto, UploadQuestionMediaDto } from './dto/upload-question-media.dto';

@ApiTags('Exams')
@Controller('exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo đề thi mới (title, tags, chế độ, privacy)',
    description:
      'Yêu cầu đăng nhập. Kiểm tra quota hàng ngày trước khi tạo đề. ' +
      'Yêu cầu có ít nhất 1 chế độ thi được bật và đáp án đúng phải khớp với một trong các lựa chọn.',
  })
  @ApiResponse({ status: 201, description: 'Tạo đề thi thành công' })
  @ApiResponse({
    status: 400,
    description:
      'Dữ liệu không hợp lệ (INVALID_TITLE, AT_LEAST_ONE_MODE_REQUIRED, INVALID_CORRECT_ANSWER)',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({
    status: 429,
    description: 'DAILY_QUOTA_EXCEEDED - Đã vượt quá số lượng tạo đề trong ngày',
  })
  async createExam(@Body() dto: CreateExamDto, @CurrentUser() user: { sub: string }) {
    const exam = await this.examService.createExam(dto, user.sub);
    return {
      message: SuccessMessage.EXAM_CREATE_SUCCESS,
      data: exam,
    };
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách đề Công khai (phân trang, tìm kiếm, lọc)',
    description:
      'Không bắt buộc token. Chỉ trả đề public nếu không có token hoặc token không phải chủ đề. ' +
      'Nếu có token và createdBy = chính user đó → trả thêm cả đề private của họ.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách đề thi thành công' })
  async getExams(@Query() query: QueryExamDto, @CurrentUser() user?: { sub: string }) {
    return this.examService.findAllExams(query, user?.sub);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách đề của chính mình (cả public & private)',
    description: 'Yêu cầu đăng nhập. Trả về toàn bộ danh sách đề thi do chính user hiện tại tạo.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách đề thi của tôi thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async getMyExams(@Query() query: QueryExamDto, @CurrentUser() user: { sub: string }) {
    return this.examService.findMyExams(query, user.sub);
  }

  @Get(':examId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chi tiết 1 đề (metadata, không gồm nội dung câu hỏi đầy đủ)',
    description:
      'Không bắt buộc token. Chỉ trả đề public nếu không có token hoặc token không phải chủ đề. ' +
      'Nếu có token và createdBy = chính user đó → cho phép trả cả đề private của họ.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết đề thi thành công' })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền truy cập đề thi này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi' })
  async getExamDetail(@Param('examId') examId: string, @CurrentUser() user?: { sub: string }) {
    const exam = await this.examService.getExamDetail(examId, user?.sub);
    return {
      message: SuccessMessage.EXAM_GET_DETAIL_SUCCESS,
      data: exam,
    };
  }

  @Get(':examId/questions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xem câu hỏi của đề (Preview / Làm bài)',
    description:
      'Không bắt buộc token. Lấy danh sách câu hỏi theo vai trò và mode (practice | exam). ' +
      'Guest/Làm bài thật: ẩn đáp án và giải thích. ' +
      'User Thi thử: hiện giải thích, ẩn đáp án. ' +
      'Chủ đề xem/sửa: hiện đầy đủ cả đáp án đúng.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách câu hỏi thành công' })
  @ApiResponse({ status: 400, description: 'Chế độ làm bài không được hỗ trợ bởi đề thi' })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền truy cập đề thi này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi' })
  async getExamQuestions(
    @Param('examId') examId: string,
    @Query() query: GetExamQuestionsQueryDto,
    @CurrentUser() user?: { sub: string },
  ) {
    const questions = await this.examService.getExamQuestions(examId, query, user?.sub);
    return {
      message: SuccessMessage.EXAM_GET_QUESTIONS_SUCCESS,
      data: questions,
    };
  }

  @Put(':examId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật đề thi',
    description:
      'Yêu cầu đăng nhập. Chỉ chủ đề mới có quyền cập nhật thông tin và danh sách câu hỏi.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Cập nhật đề thi thành công' })
  @ApiResponse({
    status: 400,
    description:
      'Dữ liệu không hợp lệ (INVALID_TITLE, AT_LEAST_ONE_MODE_REQUIRED, INVALID_CORRECT_ANSWER)',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền thực hiện hành động này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi' })
  async updateExam(
    @Param('examId') examId: string,
    @Body() dto: UpdateExamDto,
    @CurrentUser() user: { sub: string },
  ) {
    const exam = await this.examService.updateExam(examId, dto, user.sub);
    return {
      message: SuccessMessage.EXAM_UPDATE_SUCCESS,
      data: exam,
    };
  }

  @Patch(':examId/privacy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đổi quyền riêng tư của đề thi',
    description: 'Yêu cầu đăng nhập. Chỉ chủ đề mới có quyền thay đổi trạng thái public/private.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Cập nhật quyền riêng tư thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền thực hiện hành động này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi' })
  async updateExamPrivacy(
    @Param('examId') examId: string,
    @Body() dto: UpdateExamPrivacyDto,
    @CurrentUser() user: { sub: string },
  ) {
    const exam = await this.examService.updatePrivacy(examId, dto.privacy, user.sub);
    return {
      message: SuccessMessage.EXAM_UPDATE_PRIVACY_SUCCESS,
      data: exam,
    };
  }

  @Delete(':examId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa đề thi',
    description: 'Yêu cầu đăng nhập. Chủ đề hoặc Admin mới có quyền xóa mềm đề thi.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Xóa đề thi thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền thực hiện hành động này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi' })
  async deleteExam(
    @Param('examId') examId: string,
    @CurrentUser() user: { sub: string; role?: string },
  ) {
    await this.examService.deleteExam(examId, user);
    return {
      message: SuccessMessage.EXAM_DELETE_SUCCESS,
    };
  }

  @Post(':examId/questions/:questionId/media')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 }, // Trần an toàn 100MB cho buffer bộ nhớ; giới hạn cụ thể do SystemConfig kiểm tra
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload ảnh/audio cho 1 câu hỏi',
    description:
      'Yêu cầu đăng nhập. Chỉ chủ đề mới có quyền upload media cho câu hỏi. ' +
      'Giới hạn: Ảnh, Audio và tổng media đề thi được kiểm tra tự động theo cấu hình hệ thống (SystemConfig). ' +
      'Định dạng: jpg, png, webp cho ảnh hoặc mp3 cho audio.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiParam({ name: 'questionId', description: 'ID câu hỏi (ObjectId)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh (jpg/png/webp) hoặc audio (mp3)',
        },
        type: {
          type: 'string',
          enum: ['image', 'audio'],
          description: 'Loại media (image hoặc audio)',
        },
        durationSeconds: {
          type: 'number',
          description: 'Thời lượng audio (giây) nếu client xác định trước',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload media câu hỏi thành công',
    type: QuestionMediaResponseDto,
  })
  @ApiResponse({ status: 400, description: 'INVALID_FILE_TYPE hoặc thiếu file' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền thực hiện hành động này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi hoặc câu hỏi' })
  @ApiResponse({
    status: 413,
    description:
      'IMAGE_TOO_LARGE, AUDIO_LIMIT_EXCEEDED, hoặc EXAM_MEDIA_QUOTA_EXCEEDED theo cấu hình hệ thống',
  })
  async uploadQuestionMedia(
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadQuestionMediaDto,
    @CurrentUser() user: { sub: string },
  ) {
    const data = await this.examService.uploadQuestionMedia(
      examId,
      questionId,
      file,
      dto,
      user.sub,
    );
    return {
      message: SuccessMessage.EXAM_UPLOAD_MEDIA_SUCCESS,
      data,
    };
  }

  @Delete(':examId/questions/:questionId/media')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa media khỏi câu hỏi',
    description: 'Yêu cầu đăng nhập. Chỉ chủ đề mới có quyền xóa media khỏi câu hỏi.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiParam({ name: 'questionId', description: 'ID câu hỏi (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Xóa media khỏi câu hỏi thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền thực hiện hành động này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi hoặc câu hỏi' })
  async deleteQuestionMedia(
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: { sub: string },
  ) {
    await this.examService.deleteQuestionMedia(examId, questionId, user.sub);
    return {
      message: SuccessMessage.EXAM_DELETE_MEDIA_SUCCESS,
    };
  }
}
