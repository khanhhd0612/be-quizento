import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { PracticeSessionService } from './practice-session.service';
import { CreatePracticeSessionDto } from './dto/create-practice-session.dto';
import { SubmitSessionAnswerDto } from './dto/submit-session-answer.dto';
import { SubmitSessionDto } from './dto/submit-session.dto';
import { QueryUserSessionsDto } from './dto/query-user-sessions.dto';
import { SuccessMessage } from '@common/constants/success-message.constant';

@ApiTags('Practice Sessions')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PracticeSessionController {
  constructor(private readonly practiceSessionService: PracticeSessionService) {}

  @Post('exams/:examId/sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bắt đầu 1 lượt làm bài mới (Thi thử hoặc Làm bài thật)',
    description:
      'Yêu cầu đăng nhập. Kiểm tra exam.practiceModeEnabled hoặc examModeEnabled tương ứng có bật không. Nếu tắt, trả 403 MODE_NOT_ALLOWED.',
  })
  @ApiParam({ name: 'examId', description: 'ID đề thi (ObjectId)' })
  @ApiResponse({ status: 201, description: 'Bắt đầu lượt làm bài mới thành công' })
  @ApiResponse({
    status: 403,
    description: 'MODE_NOT_ALLOWED - Chế độ làm bài không được hỗ trợ bởi đề thi',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đề thi' })
  async startSession(
    @Param('examId') examId: string,
    @Body() dto: CreatePracticeSessionDto,
    @CurrentUser() user: { sub: string },
  ) {
    const session = await this.practiceSessionService.startSession(examId, dto, user.sub);
    return {
      message: SuccessMessage.SESSION_START_SUCCESS,
      data: session,
    };
  }

  @Post('sessions/:sessionId/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nộp câu trả lời cho 1 câu (autosave)',
    description:
      'Chỉ chủ sở hữu lượt làm bài được nộp. Nếu mode=practice → trả ngay isCorrect & explanation. Nếu mode=exam → chỉ trả { saved: true }, không lộ đáp án đúng.',
  })
  @ApiParam({ name: 'sessionId', description: 'ID lượt làm bài (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Lưu câu trả lời thành công' })
  @ApiResponse({ status: 400, description: 'Lượt làm bài đã kết thúc hoặc câu hỏi không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không phải chủ sở hữu lượt làm bài' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lượt làm bài hoặc câu hỏi' })
  async submitAnswer(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitSessionAnswerDto,
    @CurrentUser() user: { sub: string },
  ) {
    const result = await this.practiceSessionService.submitAnswer(sessionId, dto, user.sub);
    return {
      message: SuccessMessage.SESSION_SUBMIT_ANSWER_SUCCESS,
      data: result,
      ...result,
    };
  }

  @Post('sessions/:sessionId/answers/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lưu batch danh sách câu trả lời',
    description: 'Chỉ chủ sở hữu lượt làm bài được lưu. Lưu nhiều câu trả lời cùng 1 lúc.',
  })
  @ApiParam({ name: 'sessionId', description: 'ID lượt làm bài (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Lưu batch câu trả lời thành công' })
  @ApiResponse({ status: 400, description: 'Lượt làm bài đã kết thúc hoặc không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không phải chủ sở hữu lượt làm bài' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lượt làm bài' })
  async batchSubmitAnswers(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitSessionDto,
    @CurrentUser() user: { sub: string },
  ) {
    const result = await this.practiceSessionService.batchSubmitAnswers(sessionId, dto, user.sub);
    return {
      message: SuccessMessage.SESSION_SUBMIT_ANSWER_SUCCESS,
      data: result,
    };
  }

  @Post('sessions/:sessionId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nộp toàn bộ, kết thúc lượt làm bài (hỗ trợ gửi kèm batch answers)',
    description:
      'Tính score.correct/total, set status=completed, finishedAt. ' +
      'Cập nhật exams.stats (attemptCount, avgScore) và questions[].wrongCount/answeredCount. ' +
      'Nếu roundNumber=1 và mode=exam → ghi nhận vào lịch sử chính thức.',
  })
  @ApiParam({ name: 'sessionId', description: 'ID lượt làm bài (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Nộp bài thi thành công' })
  @ApiResponse({ status: 400, description: 'Lượt làm bài đã kết thúc trước đó' })
  @ApiResponse({ status: 403, description: 'Không phải chủ sở hữu lượt làm bài' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lượt làm bài' })
  async submitSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto?: SubmitSessionDto,
  ) {
    const session = await this.practiceSessionService.submitSession(sessionId, user.sub, dto);
    return {
      message: SuccessMessage.SESSION_SUBMIT_SUCCESS,
      data: session,
    };
  }

  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Xem chi tiết 1 lượt làm (kết quả)',
    description: 'Chỉ chủ sở hữu lượt làm bài được xem kết quả.',
  })
  @ApiParam({ name: 'sessionId', description: 'ID lượt làm bài (ObjectId)' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết lượt làm bài thành công' })
  @ApiResponse({ status: 403, description: 'Không phải chủ sở hữu lượt làm bài' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lượt làm bài' })
  async getSessionDetail(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { sub: string },
  ) {
    const session = await this.practiceSessionService.getSessionDetail(sessionId, user.sub);
    return {
      message: SuccessMessage.SESSION_GET_DETAIL_SUCCESS,
      data: session,
    };
  }

  @Post('sessions/:sessionId/retry-wrong')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo lượt mới chỉ gồm câu sai/chưa làm (chỉ mode=practice)',
    description:
      'Chỉ hợp lệ nếu session gốc mode=practice và status=completed. ' +
      'Tạo session mới: roundNumber = cha.roundNumber + 1, parentSessionId = cha._id, answers chỉ gồm câu isCorrect=false hoặc chưa trả lời.',
  })
  @ApiParam({ name: 'sessionId', description: 'ID lượt làm bài gốc (ObjectId)' })
  @ApiResponse({ status: 201, description: 'Tạo lượt làm lại câu sai thành công' })
  @ApiResponse({
    status: 400,
    description: 'Không thỏa mãn điều kiện làm lại câu sai (CANNOT_RETRY_SESSION)',
  })
  @ApiResponse({ status: 403, description: 'Không phải chủ sở hữu lượt làm bài' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lượt làm bài' })
  async retryWrong(@Param('sessionId') sessionId: string, @CurrentUser() user: { sub: string }) {
    const newSession = await this.practiceSessionService.retryWrong(sessionId, user.sub);
    return {
      message: SuccessMessage.SESSION_RETRY_WRONG_SUCCESS,
      data: newSession,
    };
  }

  @Get('users/me/sessions')
  @ApiOperation({
    summary: 'Lịch sử làm bài của chính mình (phân trang, lọc theo exam, mode, status)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách lịch sử làm bài thành công' })
  async getUserSessions(
    @CurrentUser() user: { sub: string },
    @Query() query: QueryUserSessionsDto,
  ) {
    return this.practiceSessionService.getUserSessions(user.sub, query);
  }
}
