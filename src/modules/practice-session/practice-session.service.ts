import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types, isValidObjectId } from 'mongoose';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { BusinessException } from '@common/exceptions/business.exception';
import { PaginatedResult } from '@common/dto/pagination.dto';
import { Exam } from '@modules/exam/entities/exam.entity';
import { ExamPrivacy, ExamTakeMode } from '@modules/exam/enums/exam.enum';
import { PracticeSession, PracticeSessionDocument } from './entities/practice-session.entity';
import { PracticeSessionStatus } from './enums/practice-session.enum';
import { PracticeSessionRepository } from './practice-session.repository';
import { CreatePracticeSessionDto } from './dto/create-practice-session.dto';
import { SubmitSessionAnswerDto } from './dto/submit-session-answer.dto';
import { SubmitSessionDto } from './dto/submit-session.dto';
import { QueryUserSessionsDto } from './dto/query-user-sessions.dto';

export interface SubmitAnswerResult {
  isCorrect?: boolean;
  explanation?: string | null;
  saved?: boolean;
}

@Injectable()
export class PracticeSessionService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    private readonly practiceSessionRepository: PracticeSessionRepository,
  ) {}

  /**
   * Bắt đầu một lượt làm bài mới (POST /exams/:examId/sessions)
   */
  async startSession(
    examId: string,
    dto: CreatePracticeSessionDto,
    userId: string,
  ): Promise<PracticeSessionDocument> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examModel.findOne({ _id: examId, deletedAt: null }).exec();

    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    // 1. Kiểm tra quyền truy cập nếu đề ở trạng thái private
    const ownerId =
      (exam.createdBy as any)?._id?.toString() ||
      (exam.createdBy as any)?.id?.toString() ||
      exam.createdBy?.toString();
    const isOwner = Boolean(userId && ownerId === userId);

    if (exam.privacy === ExamPrivacy.PRIVATE && !isOwner) {
      throw new BusinessException(
        ErrorCode.EXAM_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
      );
    }

    // 2. Kiểm tra chế độ làm bài có được bật trên đề thi không
    if (dto.mode === ExamTakeMode.PRACTICE && !exam.practiceModeEnabled) {
      throw new BusinessException(
        ErrorCode.MODE_NOT_ALLOWED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.MODE_NOT_ALLOWED],
      );
    }

    if (dto.mode === ExamTakeMode.EXAM && !exam.examModeEnabled) {
      throw new BusinessException(
        ErrorCode.MODE_NOT_ALLOWED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.MODE_NOT_ALLOWED],
      );
    }

    const total = exam.questions?.length || 0;
    const questionIds = (exam.questions || []).map((q) => q._id);

    // 3. Khởi tạo session mới (roundNumber = 1)
    const session = await this.practiceSessionRepository.create({
      examId: exam._id,
      userId: new Types.ObjectId(userId),
      mode: dto.mode,
      roundNumber: 1,
      parentSessionId: null,
      questionIds,
      startedAt: new Date(),
      finishedAt: null,
      score: {
        correct: 0,
        total,
      },
      answers: [],
      status: PracticeSessionStatus.IN_PROGRESS,
      isOfficial: false,
    });

    return session;
  }

  /**
   * Nộp câu trả lời cho 1 câu (POST /sessions/:sessionId/answers)
   */
  async submitAnswer(
    sessionId: string,
    dto: SubmitSessionAnswerDto,
    userId: string,
  ): Promise<SubmitAnswerResult> {
    if (!isValidObjectId(sessionId)) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    const session = await this.practiceSessionRepository.findById(sessionId);
    if (!session) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    // 1. Kiểm tra chủ sở hữu session
    if (session.userId.toString() !== userId) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.FORBIDDEN],
      );
    }

    // 2. Kiểm tra trạng thái session
    if (session.status === PracticeSessionStatus.COMPLETED) {
      throw new BusinessException(
        ErrorCode.SESSION_ALREADY_COMPLETED,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.SESSION_ALREADY_COMPLETED],
      );
    }

    // 3. Tìm đề thi để đối chiếu câu hỏi và đáp án
    const exam = await this.examModel.findOne({ _id: session.examId, deletedAt: null }).exec();

    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const question = exam.questions.find((q) => q._id.toString() === dto.questionId);
    if (!question) {
      throw new BusinessException(
        ErrorCode.QUESTION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUESTION_NOT_FOUND],
      );
    }

    // Nếu là lượt làm lại (roundNumber > 1), kiểm tra câu hỏi có thuộc danh sách làm lại không
    if (
      session.roundNumber > 1 &&
      session.questionIds &&
      session.questionIds.length > 0 &&
      !session.questionIds.some((id) => id.toString() === dto.questionId)
    ) {
      throw new BusinessException(
        ErrorCode.QUESTION_NOT_IN_RETRY,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.QUESTION_NOT_IN_RETRY],
      );
    }

    const isCorrect =
      question.correctAnswerKey.trim().toUpperCase() === dto.selectedKey.trim().toUpperCase();

    // 4. Lưu / cập nhật câu trả lời trong session
    const existingIndex = session.answers.findIndex(
      (a) => a.questionId.toString() === dto.questionId,
    );

    const answerRecord = {
      questionId: question._id,
      selectedKey: dto.selectedKey,
      isCorrect,
      answeredAt: new Date(),
    };

    if (existingIndex >= 0) {
      session.answers[existingIndex] = answerRecord as any;
    } else {
      session.answers.push(answerRecord as any);
    }

    await session.save();

    // 5. Trả về kết quả tuỳ theo mode
    if (session.mode === ExamTakeMode.PRACTICE) {
      return {
        isCorrect,
        explanation: question.explanation || '',
      };
    }

    // Mode exam: không làm lộ đáp án đúng
    return {
      saved: true,
    };
  }

  /**
   * Lưu batch câu trả lời (POST /sessions/:sessionId/answers/batch)
   */
  async batchSubmitAnswers(
    sessionId: string,
    dto: SubmitSessionDto,
    userId: string,
  ): Promise<{ savedCount: number }> {
    if (!isValidObjectId(sessionId)) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    const session = await this.practiceSessionRepository.findById(sessionId);
    if (!session) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    if (session.userId.toString() !== userId) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.FORBIDDEN],
      );
    }

    if (session.status === PracticeSessionStatus.COMPLETED) {
      throw new BusinessException(
        ErrorCode.SESSION_ALREADY_COMPLETED,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.SESSION_ALREADY_COMPLETED],
      );
    }

    const exam = await this.examModel.findOne({ _id: session.examId, deletedAt: null }).exec();
    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    let savedCount = 0;
    if (dto?.answers && Array.isArray(dto.answers)) {
      for (const item of dto.answers) {
        const question = exam.questions.find((q) => q._id.toString() === item.questionId);
        if (!question) continue;

        const isCorrect =
          question.correctAnswerKey.trim().toUpperCase() === item.selectedKey.trim().toUpperCase();

        const existingIdx = session.answers.findIndex(
          (a) => a.questionId.toString() === item.questionId,
        );

        const answerRecord = {
          questionId: question._id,
          selectedKey: item.selectedKey,
          isCorrect,
          answeredAt: new Date(),
        };

        if (existingIdx >= 0) {
          session.answers[existingIdx] = answerRecord as any;
        } else {
          session.answers.push(answerRecord as any);
        }
        savedCount++;
      }
      await session.save();
    }

    return { savedCount };
  }

  /**
   * Nộp toàn bộ, kết thúc lượt làm (POST /sessions/:sessionId/submit)
   */
  async submitSession(
    sessionId: string,
    userId: string,
    dto?: SubmitSessionDto,
  ): Promise<PracticeSessionDocument> {
    if (!isValidObjectId(sessionId)) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    const session = await this.practiceSessionRepository.findById(sessionId);
    if (!session) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    // 1. Kiểm tra chủ sở hữu session
    if (session.userId.toString() !== userId) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.FORBIDDEN],
      );
    }

    // 2. Kiểm tra nếu đã hoàn thành trước đó
    if (session.status === PracticeSessionStatus.COMPLETED) {
      throw new BusinessException(
        ErrorCode.SESSION_ALREADY_COMPLETED,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.SESSION_ALREADY_COMPLETED],
      );
    }

    // 3. Tìm đề thi để cập nhật stats và questions counters
    const exam = await this.examModel.findOne({ _id: session.examId, deletedAt: null }).exec();

    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    // 3b. Xử lý batch answers nếu gửi kèm trong payload nộp bài
    if (dto?.answers && Array.isArray(dto.answers) && dto.answers.length > 0) {
      for (const item of dto.answers) {
        const question = exam.questions.find((q) => q._id.toString() === item.questionId);
        if (!question) continue;

        const isCorrect =
          question.correctAnswerKey.trim().toUpperCase() === item.selectedKey.trim().toUpperCase();

        const existingIdx = session.answers.findIndex(
          (a) => a.questionId.toString() === item.questionId,
        );

        const answerRecord = {
          questionId: question._id,
          selectedKey: item.selectedKey,
          isCorrect,
          answeredAt: new Date(),
        };

        if (existingIdx >= 0) {
          session.answers[existingIdx] = answerRecord as any;
        } else {
          session.answers.push(answerRecord as any);
        }
      }
    }

    // 4. Tính toán điểm số & hoàn thành session
    const correctCount = session.answers.filter((a) => a.isCorrect).length;
    const total =
      session.score?.total ||
      (session.roundNumber === 1 ? exam.questions?.length || 0 : session.answers?.length || 0);

    session.score = {
      correct: correctCount,
      total,
    };
    session.status = PracticeSessionStatus.COMPLETED;
    session.finishedAt = new Date();

    // Nếu roundNumber=1 và mode=exam → ghi nhận vào lịch sử chính thức
    if (session.roundNumber === 1 && session.mode === ExamTakeMode.EXAM) {
      session.isOfficial = true;
    }

    await session.save();

    // 5. Cập nhật questions[].wrongCount và answeredCount
    for (const ans of session.answers) {
      const q = exam.questions.find((item) => item._id.toString() === ans.questionId.toString());
      if (q) {
        q.answeredCount = (q.answeredCount || 0) + 1;
        if (!ans.isCorrect) {
          q.wrongCount = (q.wrongCount || 0) + 1;
        }
      }
    }

    // 6. Cập nhật exams.stats (attemptCount, avgScore) khi roundNumber = 1
    if (session.roundNumber === 1) {
      const oldAttemptCount = exam.stats?.attemptCount || 0;
      const newAttemptCount = oldAttemptCount + 1;
      const sessionScore = total > 0 ? (correctCount / total) * 10 : 0;
      const currentAvg = exam.stats?.avgScore || 0;
      const newAvgScore = Number(
        ((currentAvg * oldAttemptCount + sessionScore) / newAttemptCount).toFixed(2),
      );

      if (!exam.stats) {
        exam.stats = {
          attemptCount: newAttemptCount,
          avgScore: newAvgScore,
          avgRating: 0,
          ratingCount: 0,
        };
      } else {
        exam.stats.attemptCount = newAttemptCount;
        exam.stats.avgScore = newAvgScore;
      }
    }

    await exam.save();

    return session;
  }

  /**
   * Xem chi tiết 1 lượt làm (GET /sessions/:sessionId)
   */
  async getSessionDetail(sessionId: string, userId: string): Promise<PracticeSessionDocument> {
    if (!isValidObjectId(sessionId)) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    const session = await this.practiceSessionRepository.findById(sessionId);
    if (!session) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    // Kiểm tra quyền: chỉ chủ session được xem
    if (session.userId.toString() !== userId) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.FORBIDDEN],
      );
    }

    return session;
  }

  /**
   * Tạo lượt mới chỉ gồm câu sai/chưa làm (POST /sessions/:sessionId/retry-wrong)
   * Chỉ hợp lệ nếu session gốc mode=practice và status=completed
   */
  async retryWrong(sessionId: string, userId: string): Promise<PracticeSessionDocument> {
    if (!isValidObjectId(sessionId)) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    const parentSession = await this.practiceSessionRepository.findById(sessionId);
    if (!parentSession) {
      throw new BusinessException(
        ErrorCode.PRACTICE_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.PRACTICE_SESSION_NOT_FOUND],
      );
    }

    // 1. Kiểm tra quyền chủ sở hữu
    if (parentSession.userId.toString() !== userId) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.FORBIDDEN],
      );
    }

    // 2. Kiểm tra điều kiện mode=practice và status=completed
    if (parentSession.mode !== ExamTakeMode.PRACTICE) {
      throw new BusinessException(
        ErrorCode.CANNOT_RETRY_SESSION,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.CANNOT_RETRY_SESSION],
      );
    }

    if (parentSession.status !== PracticeSessionStatus.COMPLETED) {
      throw new BusinessException(
        ErrorCode.CANNOT_RETRY_SESSION,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.CANNOT_RETRY_SESSION],
      );
    }

    // 3. Tìm đề thi để lấy danh sách câu hỏi
    const exam = await this.examModel
      .findOne({ _id: parentSession.examId, deletedAt: null })
      .exec();

    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    // 4. Lọc các câu sai hoặc chưa làm trong lượt cha:
    // - Câu trả lời đúng:
    const correctQuestionIds = new Set(
      parentSession.answers.filter((a) => a.isCorrect).map((a) => a.questionId.toString()),
    );

    // - Danh sách câu hỏi trong lượt cha:
    let parentQuestionIds: string[];
    if (parentSession.questionIds && parentSession.questionIds.length > 0) {
      parentQuestionIds = parentSession.questionIds.map((id) => id.toString());
    } else {
      parentQuestionIds = exam.questions.map((q) => q._id.toString());
    }

    // - Câu sai hoặc chưa trả lời = parentQuestions trừ đi các câu đã trả lời đúng
    const retryQuestionIds = parentQuestionIds.filter((qId) => !correctQuestionIds.has(qId));

    if (retryQuestionIds.length === 0) {
      throw new BusinessException(
        ErrorCode.CANNOT_RETRY_SESSION,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.CANNOT_RETRY_SESSION],
      );
    }

    // 5. Tạo session mới: roundNumber = cha.roundNumber + 1, parentSessionId = cha._id
    const newSession = await this.practiceSessionRepository.create({
      examId: parentSession.examId,
      userId: parentSession.userId,
      mode: ExamTakeMode.PRACTICE,
      roundNumber: parentSession.roundNumber + 1,
      parentSessionId: parentSession._id,
      questionIds: retryQuestionIds.map((id) => new Types.ObjectId(id)),
      startedAt: new Date(),
      finishedAt: null,
      score: {
        correct: 0,
        total: retryQuestionIds.length,
      },
      answers: [],
      status: PracticeSessionStatus.IN_PROGRESS,
      isOfficial: false,
    });

    return newSession;
  }

  /**
   * Lấy lịch sử làm bài của người dùng (GET /users/me/sessions)
   */
  async getUserSessions(
    userId: string,
    query: QueryUserSessionsDto,
  ): Promise<PaginatedResult<PracticeSession>> {
    const filter: FilterQuery<PracticeSession> = {
      userId: new Types.ObjectId(userId),
      deletedAt: null,
    };

    if (query.examId) {
      filter.examId = new Types.ObjectId(query.examId);
    }

    if (query.mode) {
      filter.mode = query.mode;
    }

    if (query.status) {
      filter.status = query.status;
    }

    const sortOrder: SortOrder = query.sortOrder === 'ASC' ? 1 : -1;
    const sort: Record<string, SortOrder> = {
      [query.sortBy || 'createdAt']: sortOrder,
    };

    const { items, total } = await this.practiceSessionRepository.findWithPagination(
      filter,
      sort,
      query.skip,
      query.limit,
    );

    return new PaginatedResult<PracticeSession>(
      items,
      total,
      query,
      'Lấy danh sách lịch sử làm bài thành công',
    );
  }
}
