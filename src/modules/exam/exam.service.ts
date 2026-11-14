import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types, isValidObjectId } from 'mongoose';
import { BaseService } from '@common/base/base.service';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { BusinessException } from '@common/exceptions/business.exception';
import { PaginatedResult } from '@common/dto/pagination.dto';
import { Exam } from './entities/exam.entity';
import { ExamRepository } from './exam.repository';
import { QueryExamDto } from './dto/query-exam.dto';
import { GetExamQuestionsQueryDto } from './dto/get-exam-questions.dto';
import { CreateExamDto, CreateExamQuestionDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamPrivacy, ExamSortOption, ExamTakeMode, QuestionMediaType } from './enums/exam.enum';
import { UserRole } from '@common/enums/user-role.enum';
import { SystemConfigService } from '../system-config/system-config.service';
import { DEFAULT_SYSTEM_CONFIG } from '../system-config/entities/system-config.entity';
import { UploadService } from '../upload/upload.service';
import { DailyQuotaService } from '../daily-quota/daily-quota.service';
import { QuestionMediaResponseDto, UploadQuestionMediaDto } from './dto/upload-question-media.dto';
import * as path from 'path';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
} from '@common/utils/multer.util';
import {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_AUDIO_MIME_TYPES,
  estimateMp3Duration,
} from '@common/utils/audio.util';
import { escapeRegex } from '@common/utils/regex.util';
import {
  formatBytesToMB,
  formatDuration,
  formatImageTooLargeMessage,
  formatAudioLimitExceededMessage,
  formatExamMediaQuotaExceededMessage,
} from '@common/utils/format.util';

@Injectable()
export class ExamService extends BaseService<Exam> {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<Exam>,
    private readonly examRepository: ExamRepository,
    private readonly systemConfigService: SystemConfigService,
    private readonly uploadService: UploadService,
    @Optional() private readonly dailyQuotaService?: DailyQuotaService,
  ) {
    super(examModel, ErrorCode.EXAM_NOT_FOUND);
  }

  /**
   * Lấy danh sách đề thi (phân trang, tìm kiếm, lọc)
   */
  async findAllExams(query: QueryExamDto, currentUserId?: string): Promise<PaginatedResult<Exam>> {
    const conditions: FilterQuery<Exam>[] = [{ deletedAt: null }];

    // 1. Phân quyền và lọc theo người tạo (createdBy)
    if (query.createdBy) {
      const targetUserId = new Types.ObjectId(query.createdBy);
      if (currentUserId && currentUserId === query.createdBy) {
        // Đang xem danh sách đề của chính mình -> lấy cả public và private
        conditions.push({ createdBy: targetUserId });
      } else {
        // Khách hoặc xem danh sách đề của người khác -> chỉ lấy public
        conditions.push({ createdBy: targetUserId, privacy: ExamPrivacy.PUBLIC });
      }
    } else {
      if (currentUserId) {
        // Đã đăng nhập nhưng không lọc theo user cụ thể:
        // Thấy tất cả đề public HOẶC đề private của chính mình
        conditions.push({
          $or: [{ privacy: ExamPrivacy.PUBLIC }, { createdBy: new Types.ObjectId(currentUserId) }],
        });
      } else {
        // Khách vãng lai: chỉ thấy đề public
        conditions.push({ privacy: ExamPrivacy.PUBLIC });
      }
    }

    // 2. Tìm kiếm theo title / tags qua 'q'
    if (query.q && query.q.trim()) {
      const searchRegex = new RegExp(escapeRegex(query.q.trim()), 'i');
      conditions.push({
        $or: [{ title: { $regex: searchRegex } }, { tags: { $in: [searchRegex] } }],
      });
    }

    // 3. Lọc theo tags (phân tách bởi dấu phẩy)
    if (query.tags && query.tags.trim()) {
      const tagList = query.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      if (tagList.length > 0) {
        conditions.push({ tags: { $in: tagList } });
      }
    }

    // 4. Xác định tiêu chí sắp xếp
    let sortOption: Record<string, SortOrder> = { createdAt: -1 };
    if (query.sort === ExamSortOption.POPULAR) {
      sortOption = { 'stats.attemptCount': -1, createdAt: -1 };
    } else if (query.sort === ExamSortOption.RATING) {
      sortOption = { 'stats.avgRating': -1, 'stats.ratingCount': -1, createdAt: -1 };
    }

    const finalFilter: FilterQuery<Exam> =
      conditions.length === 1 ? conditions[0] : { $and: conditions };

    const { items, total } = await this.examRepository.findWithPagination(
      finalFilter,
      sortOption,
      query.skip,
      query.limit,
    );

    return new PaginatedResult<Exam>(items, total, query as any, 'Lấy danh sách đề thi thành công');
  }

  /**
   * Lấy chi tiết metadata 1 đề thi (không bao gồm nội dung câu hỏi đầy đủ)
   * Yêu cầu nghiệp vụ:
   * - Chỉ trả đề privacy: 'public' nếu không có token hoặc token không phải chủ đề
   * - Nếu có token và createdBy = chính user đó → cho phép trả đề private của họ
   */
  async getExamDetail(examId: string, currentUserId?: string): Promise<Exam> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examRepository.findMetadataById(examId);
    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    // Kiểm tra quyền riêng tư nếu đề thi ở trạng thái private
    if (exam.privacy === ExamPrivacy.PRIVATE) {
      const ownerId =
        (exam.createdBy as any)?._id?.toString() ||
        (exam.createdBy as any)?.id?.toString() ||
        exam.createdBy?.toString();

      const isOwner = Boolean(currentUserId && ownerId === currentUserId);
      if (!isOwner) {
        throw new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
        );
      }
    }

    return exam;
  }

  /**
   * Lấy danh sách câu hỏi của đề thi (Preview / Làm bài)
   * Nghiệp vụ phân quyền hiển thị:
   * - Guest, đề public: Ẩn correctAnswerKey và explanation
   * - Guest, đề private: 403 Forbidden
   * - User, đề public, mode=exam: Ẩn correctAnswerKey và explanation (làm bài thật, chống gian lận)
   * - User, đề public, mode=practice: Ẩn correctAnswerKey, hiện explanation (chế độ thi thử)
   * - User không phải chủ đề, đề private: 403 Forbidden
   * - User là chủ đề, đề private/public: Trả toàn bộ, kể cả đáp án đúng (chế độ xem/sửa)
   */
  async getExamQuestions(
    examId: string,
    query: GetExamQuestionsQueryDto,
    currentUserId?: string,
  ): Promise<any[]> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examRepository.findById(examId);
    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const ownerId =
      (exam.createdBy as any)?._id?.toString() ||
      (exam.createdBy as any)?.id?.toString() ||
      exam.createdBy?.toString();

    const isOwner = Boolean(currentUserId && ownerId === currentUserId);

    // 1. Kiểm tra quyền truy cập nếu đề ở trạng thái private
    if (exam.privacy === ExamPrivacy.PRIVATE && !isOwner) {
      throw new BusinessException(
        ErrorCode.EXAM_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
      );
    }

    // 2. Kiểm tra chế độ làm bài có được bật trên đề thi không
    if (query.mode === ExamTakeMode.PRACTICE && !exam.practiceModeEnabled) {
      throw new BusinessException(
        ErrorCode.MODE_NOT_ALLOWED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.MODE_NOT_ALLOWED],
      );
    }

    if (query.mode === ExamTakeMode.EXAM && !exam.examModeEnabled) {
      throw new BusinessException(
        ErrorCode.MODE_NOT_ALLOWED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.MODE_NOT_ALLOWED],
      );
    }

    // 3. Phân quyền ẩn / hiện đáp án và giải thích:
    // - allowCorrectAnswer: Chủ đề ở chế độ xem/sửa HOẶC chế độ thi thử (mode=practice) để client tự so sánh 0ms
    const allowCorrectAnswer =
      (isOwner && !query.mode) || query.mode === ExamTakeMode.PRACTICE;

    // - allowExplanation:
    //   + Chủ đề ở chế độ xem/sửa: được thấy
    //   + Chế độ thi thử (mode=practice): được thấy
    //   + Ngược lại (mode=exam, hoặc khách, hoặc preview chưa chọn mode): ẩn
    const allowExplanation =
      (isOwner && !query.mode) || query.mode === ExamTakeMode.PRACTICE;

    const sortedQuestions = [...(exam.questions || [])].sort((a, b) => a.order - b.order);

    // Đối với khách (Guest): Giới hạn số câu preview theo cấu hình động systemConfig
    let questionsToReturn = sortedQuestions;
    if (!currentUserId) {
      const publicConfig = await this.systemConfigService.getPublicConfig();
      const total = sortedQuestions.length;
      const guestPreviewMaxQuestions =
        publicConfig?.guestPreviewMaxQuestions ?? DEFAULT_SYSTEM_CONFIG.guestPreviewMaxQuestions;
      const guestPreviewMaxPercent =
        publicConfig?.guestPreviewMaxPercent ?? DEFAULT_SYSTEM_CONFIG.guestPreviewMaxPercent;
      const maxPreview = Math.min(
        guestPreviewMaxQuestions,
        Math.ceil(total * guestPreviewMaxPercent),
      );
      questionsToReturn = sortedQuestions.slice(0, maxPreview);
    }

    return questionsToReturn.map((q) => {
      const item: Record<string, any> = {
        _id: q._id,
        id: q._id?.toString(),
        order: q.order,
        content: q.content,
        choices: q.choices,
        media: q.media,
        topic: (q as any).topic ?? null,
        wrongCount: q.wrongCount,
        answeredCount: q.answeredCount,
      };

      if (allowCorrectAnswer) {
        item.correctAnswerKey = q.correctAnswerKey;
      }

      if (allowExplanation) {
        item.explanation = q.explanation ?? null;
      }

      return item;
    });
  }

  /**
   * Helper kiểm tra tính hợp lệ của tiêu đề đề thi
   */
  private validateTitle(title?: string): void {
    if (!title || typeof title !== 'string' || !title.trim() || title.trim().length > 150) {
      throw new BusinessException(
        ErrorCode.INVALID_TITLE,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.INVALID_TITLE],
      );
    }
  }

  /**
   * Helper kiểm tra tính hợp lệ của chế độ đề thi (ít nhất 1 chế độ = true)
   */
  private validateModes(practiceMode?: boolean, examMode?: boolean): void {
    if (practiceMode === false && examMode === false) {
      throw new BusinessException(
        ErrorCode.AT_LEAST_ONE_MODE_REQUIRED,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.AT_LEAST_ONE_MODE_REQUIRED],
      );
    }
  }

  /**
   * Helper kiểm tra tính hợp lệ của danh sách câu hỏi:
   * correctAnswerKey phải khớp với 1 trong choices[].key
   */
  private validateQuestions(questions?: CreateExamQuestionDto[]): void {
    if (!questions || questions.length === 0) return;

    for (const q of questions) {
      if (!q.choices || !Array.isArray(q.choices) || q.choices.length === 0) {
        throw new BusinessException(
          ErrorCode.INVALID_CORRECT_ANSWER,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_CORRECT_ANSWER],
        );
      }
      const hasCorrectAnswer = q.choices.some((c) => c.key?.trim() === q.correctAnswerKey?.trim());
      if (!hasCorrectAnswer) {
        throw new BusinessException(
          ErrorCode.INVALID_CORRECT_ANSWER,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_CORRECT_ANSWER],
        );
      }
    }
  }

  /**
   * Helper kiểm tra quota tạo đề trong ngày của người dùng
   */
  private async checkDailyQuota(userId: string): Promise<void> {
    if (this.dailyQuotaService) {
      await this.dailyQuotaService.checkQuota(userId);
      return;
    }

    const quota = await this.systemConfigService.getDailyExamQuota();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const createdCount = await this.examRepository.countCreatedTodayByUser(userId, startOfDay);

    if (createdCount >= quota) {
      throw new BusinessException(
        ErrorCode.DAILY_QUOTA_EXCEEDED,
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorMessage[ErrorCode.DAILY_QUOTA_EXCEEDED],
      );
    }
  }

  /**
   * Tạo đề thi mới
   */
  async createExam(dto: CreateExamDto, userId: string): Promise<Exam> {
    // 1. Kiểm tra quota trước khi tạo
    await this.checkDailyQuota(userId);

    // 2. Validate tiêu đề
    this.validateTitle(dto.title);

    // 3. Validate chế độ (ít nhất 1 chế độ = true)
    const practiceModeEnabled =
      dto.practiceModeEnabled !== undefined ? dto.practiceModeEnabled : true;
    const examModeEnabled = dto.examModeEnabled !== undefined ? dto.examModeEnabled : true;
    this.validateModes(practiceModeEnabled, examModeEnabled);

    // 4. Validate câu hỏi và đáp án đúng
    this.validateQuestions(dto.questions);

    // 5. Chuẩn bị câu hỏi và tính tổng media
    const mappedQuestions = (dto.questions || []).map((q, index) => ({
      _id: new Types.ObjectId(),
      order: q.order ?? index + 1,
      content: q.content.trim(),
      choices: q.choices.map((c) => ({ key: c.key.trim(), text: c.text.trim() })),
      correctAnswerKey: q.correctAnswerKey.trim(),
      explanation: q.explanation?.trim() || null,
      topic: q.topic?.trim() || null,
      media: q.media
        ? {
            type: q.media.type ?? QuestionMediaType.NONE,
            url: q.media.url?.trim() || null,
            sizeBytes: q.media.sizeBytes ?? null,
          }
        : {
            type: QuestionMediaType.NONE,
            url: null,
            sizeBytes: null,
          },
      wrongCount: 0,
      answeredCount: 0,
    }));

    const totalQuestions = mappedQuestions.length;
    const totalMediaSizeBytes = mappedQuestions.reduce(
      (sum, q) => sum + (q.media?.sizeBytes || 0),
      0,
    );

    const publicConfig = await this.systemConfigService.getPublicConfig();
    const maxTotalMedia =
      publicConfig?.maxTotalMediaSizePerExam ?? DEFAULT_SYSTEM_CONFIG.maxTotalMediaSizePerExam;
    if (totalMediaSizeBytes > maxTotalMedia) {
      throw new BusinessException(
        ErrorCode.EXAM_MEDIA_QUOTA_EXCEEDED,
        HttpStatus.PAYLOAD_TOO_LARGE,
        formatExamMediaQuotaExceededMessage(maxTotalMedia),
      );
    }

    const newExam: Partial<Exam> = {
      title: dto.title.trim(),
      coverUrl: dto.coverUrl?.trim() || null,
      tags: (dto.tags || []).map((tag) => tag.trim()).filter(Boolean),
      createdBy: new Types.ObjectId(userId),
      privacy: dto.privacy ?? ExamPrivacy.PUBLIC,
      practiceModeEnabled,
      examModeEnabled,
      totalQuestions,
      totalMediaSizeBytes,
      stats: {
        attemptCount: 0,
        avgScore: 0,
        avgRating: 0,
        ratingCount: 0,
      },
      questions: mappedQuestions as any,
    };

    const createdExam = await this.examRepository.create(newExam);

    if (this.dailyQuotaService) {
      await this.dailyQuotaService.consumeQuota(userId);
    }

    return createdExam;
  }

  /**
   * Cập nhật thông tin đề thi (chỉ chủ đề mới có quyền)
   */
  async updateExam(examId: string, dto: UpdateExamDto, userId: string): Promise<Exam> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examRepository.findById(examId);
    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const ownerId =
      (exam.createdBy as any)?._id?.toString() ||
      (exam.createdBy as any)?.id?.toString() ||
      exam.createdBy?.toString();

    if (ownerId !== userId) {
      throw new BusinessException(
        ErrorCode.EXAM_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
      );
    }

    if (dto.title !== undefined) {
      this.validateTitle(dto.title);
    }

    const effectivePractice =
      dto.practiceModeEnabled !== undefined ? dto.practiceModeEnabled : exam.practiceModeEnabled;
    const effectiveExam =
      dto.examModeEnabled !== undefined ? dto.examModeEnabled : exam.examModeEnabled;

    this.validateModes(effectivePractice, effectiveExam);

    if (dto.questions !== undefined) {
      this.validateQuestions(dto.questions);
    }

    const updateData: Partial<Exam> = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.coverUrl !== undefined) {
      updateData.coverUrl = dto.coverUrl?.trim() || null;
    }
    if (dto.tags !== undefined) {
      updateData.tags = dto.tags.map((tag) => tag.trim()).filter(Boolean);
    }
    if (dto.privacy !== undefined) updateData.privacy = dto.privacy;
    if (dto.practiceModeEnabled !== undefined) {
      updateData.practiceModeEnabled = dto.practiceModeEnabled;
    }
    if (dto.examModeEnabled !== undefined) {
      updateData.examModeEnabled = dto.examModeEnabled;
    }
    if (dto.questions !== undefined) {
      const mappedQuestions = dto.questions.map((q, index) => ({
        _id: (q as any)._id ? new Types.ObjectId((q as any)._id) : new Types.ObjectId(),
        order: q.order ?? index + 1,
        content: q.content.trim(),
        choices: q.choices.map((c) => ({ key: c.key.trim(), text: c.text.trim() })),
        correctAnswerKey: q.correctAnswerKey.trim(),
        explanation: q.explanation?.trim() || null,
        topic: q.topic?.trim() || null,
        media: q.media
          ? {
              type: q.media.type ?? QuestionMediaType.NONE,
              url: q.media.url?.trim() || null,
              sizeBytes: q.media.sizeBytes ?? null,
            }
          : {
              type: QuestionMediaType.NONE,
              url: null,
              sizeBytes: null,
            },
        wrongCount: (q as any).wrongCount ?? 0,
        answeredCount: (q as any).answeredCount ?? 0,
      }));
      const totalMediaSizeBytes = mappedQuestions.reduce(
        (sum, q) => sum + (q.media?.sizeBytes || 0),
        0,
      );
      const publicConfig = await this.systemConfigService.getPublicConfig();
      const maxTotalMedia =
        publicConfig?.maxTotalMediaSizePerExam ?? DEFAULT_SYSTEM_CONFIG.maxTotalMediaSizePerExam;
      if (totalMediaSizeBytes > maxTotalMedia) {
        throw new BusinessException(
          ErrorCode.EXAM_MEDIA_QUOTA_EXCEEDED,
          HttpStatus.PAYLOAD_TOO_LARGE,
          formatExamMediaQuotaExceededMessage(maxTotalMedia),
        );
      }
      updateData.questions = mappedQuestions as any;
      updateData.totalQuestions = mappedQuestions.length;
      updateData.totalMediaSizeBytes = totalMediaSizeBytes;
    }

    const updated = await this.examRepository.update(examId, updateData);
    if (!updated) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }
    return updated;
  }

  /**
   * Đổi quyền riêng tư đề thi (chỉ chủ đề mới có quyền)
   */
  async updatePrivacy(examId: string, privacy: ExamPrivacy, userId: string): Promise<Exam> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examRepository.findById(examId);
    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const ownerId =
      (exam.createdBy as any)?._id?.toString() ||
      (exam.createdBy as any)?.id?.toString() ||
      exam.createdBy?.toString();

    if (ownerId !== userId) {
      throw new BusinessException(
        ErrorCode.EXAM_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
      );
    }

    const updated = await this.examRepository.update(examId, { privacy });
    if (!updated) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }
    return updated;
  }

  /**
   * Xóa đề thi (chủ đề hoặc Admin)
   */
  async deleteExam(examId: string, user: { sub: string; role?: string }): Promise<void> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examRepository.findById(examId);
    if (!exam) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const ownerId =
      (exam.createdBy as any)?._id?.toString() ||
      (exam.createdBy as any)?.id?.toString() ||
      exam.createdBy?.toString();

    const isOwner = ownerId === user.sub;
    const isAdmin = user.role === 'admin' || user.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new BusinessException(
        ErrorCode.EXAM_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
      );
    }

    await this.examRepository.softDelete(examId);
  }

  /**
   * Lấy danh sách đề thi của chính mình (cả public & private)
   */
  async findMyExams(query: QueryExamDto, userId: string): Promise<PaginatedResult<Exam>> {
    const myQuery = Object.assign(new QueryExamDto(), query, {
      createdBy: userId,
    });
    return this.findAllExams(myQuery, userId);
  }


  /**
   * Upload ảnh hoặc audio cho một câu hỏi trong đề thi
   */
  async uploadQuestionMedia(
    examId: string,
    questionId: string,
    file: Express.Multer.File,
    dto: UploadQuestionMediaDto,
    userId: string,
  ): Promise<QuestionMediaResponseDto> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examRepository.findById(examId);
    if (!exam || exam.deletedAt) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const ownerId =
      (exam.createdBy as any)?._id?.toString() ||
      (exam.createdBy as any)?.id?.toString() ||
      exam.createdBy?.toString();

    if (ownerId !== userId) {
      throw new BusinessException(
        ErrorCode.EXAM_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
      );
    }

    if (!isValidObjectId(questionId)) {
      throw new BusinessException(
        ErrorCode.QUESTION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUESTION_NOT_FOUND],
      );
    }

    const question = (exam.questions || []).find(
      (q) => q._id?.toString() === questionId || (q as any).id === questionId,
    );

    if (!question) {
      throw new BusinessException(
        ErrorCode.QUESTION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUESTION_NOT_FOUND],
      );
    }

    if (!file || !file.buffer) {
      throw new BusinessException(
        ErrorCode.FILE_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.FILE_NOT_FOUND],
      );
    }

    // 1. Kiểm tra định dạng hợp lệ (400 INVALID_FILE_TYPE)
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (dto.type === QuestionMediaType.IMAGE) {
      const isExtValid = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
      const isMimeValid = ALLOWED_IMAGE_MIME_TYPES.includes(mime);
      if (!isExtValid || !isMimeValid) {
        throw new BusinessException(
          ErrorCode.INVALID_FILE_TYPE,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_FILE_TYPE],
        );
      }
    } else if (dto.type === QuestionMediaType.AUDIO) {
      const isExtValid = ALLOWED_AUDIO_EXTENSIONS.includes(ext);
      const isMimeValid = ALLOWED_AUDIO_MIME_TYPES.includes(mime);
      if (!isExtValid || !isMimeValid) {
        throw new BusinessException(
          ErrorCode.INVALID_FILE_TYPE,
          HttpStatus.BAD_REQUEST,
          ErrorMessage[ErrorCode.INVALID_FILE_TYPE],
        );
      }
    } else {
      throw new BusinessException(
        ErrorCode.INVALID_FILE_TYPE,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.INVALID_FILE_TYPE],
      );
    }

    // 2. Lấy giới hạn cấu hình
    const config = await this.systemConfigService.getPublicConfig();
    const maxImageSize = config?.maxImageSizeBytes ?? DEFAULT_SYSTEM_CONFIG.maxImageSizeBytes;
    const maxAudioSize = config?.maxAudioSizeBytes ?? DEFAULT_SYSTEM_CONFIG.maxAudioSizeBytes;
    const maxAudioDuration =
      config?.maxAudioDurationSeconds ?? DEFAULT_SYSTEM_CONFIG.maxAudioDurationSeconds;
    const maxTotalMedia =
      config?.maxTotalMediaSizePerExam ?? DEFAULT_SYSTEM_CONFIG.maxTotalMediaSizePerExam;

    // 3. Kiểm tra kích thước ảnh (413 IMAGE_TOO_LARGE)
    if (dto.type === QuestionMediaType.IMAGE && file.size > maxImageSize) {
      throw new BusinessException(
        ErrorCode.IMAGE_TOO_LARGE,
        HttpStatus.PAYLOAD_TOO_LARGE,
        formatImageTooLargeMessage(maxImageSize),
      );
    }

    // 4. Kiểm tra kích thước và thời lượng audio (413 AUDIO_LIMIT_EXCEEDED)
    if (dto.type === QuestionMediaType.AUDIO) {
      if (file.size > maxAudioSize) {
        throw new BusinessException(
          ErrorCode.AUDIO_LIMIT_EXCEEDED,
          HttpStatus.PAYLOAD_TOO_LARGE,
          formatAudioLimitExceededMessage(maxAudioSize, maxAudioDuration),
        );
      }

      const duration = dto.durationSeconds ?? estimateMp3Duration(file.buffer);
      if (duration !== null && duration > maxAudioDuration) {
        throw new BusinessException(
          ErrorCode.AUDIO_LIMIT_EXCEEDED,
          HttpStatus.PAYLOAD_TOO_LARGE,
          formatAudioLimitExceededMessage(maxAudioSize, maxAudioDuration),
        );
      }
    }

    // 5. Kiểm tra tổng dung lượng đề thi (413 EXAM_MEDIA_QUOTA_EXCEEDED)
    const currentTotal = exam.totalMediaSizeBytes || 0;
    const oldMediaSize = question.media?.sizeBytes || 0;
    const newTotal = currentTotal - oldMediaSize + file.size;

    if (newTotal > maxTotalMedia) {
      throw new BusinessException(
        ErrorCode.EXAM_MEDIA_QUOTA_EXCEEDED,
        HttpStatus.PAYLOAD_TOO_LARGE,
        formatExamMediaQuotaExceededMessage(maxTotalMedia),
      );
    }

    // 6. Xoá file media cũ trên Cloudflare R2 nếu có
    if (question.media?.url) {
      await this.uploadService.deleteFileByUrl(question.media.url);
    }

    // 7. Upload file mới lên Cloudflare R2
    const uploaded = await this.uploadService.uploadSingleImage(file, {
      folder: 'exams',
    });

    // 8. Cập nhật câu hỏi và tổng dung lượng đề thi trong DB
    await this.examRepository.updateQuestionMedia(
      examId,
      questionId,
      {
        type: dto.type,
        url: uploaded.url,
        sizeBytes: file.size,
      },
      newTotal,
    );

    return {
      url: uploaded.url,
      sizeBytes: file.size,
      type: dto.type,
    };
  }

  /**
   * Xoá media khỏi một câu hỏi trong đề thi
   */
  async deleteQuestionMedia(examId: string, questionId: string, userId: string): Promise<void> {
    if (!isValidObjectId(examId)) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const exam = await this.examRepository.findById(examId);
    if (!exam || exam.deletedAt) {
      throw new BusinessException(
        ErrorCode.EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.EXAM_NOT_FOUND],
      );
    }

    const ownerId =
      (exam.createdBy as any)?._id?.toString() ||
      (exam.createdBy as any)?.id?.toString() ||
      exam.createdBy?.toString();

    if (ownerId !== userId) {
      throw new BusinessException(
        ErrorCode.EXAM_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.EXAM_FORBIDDEN],
      );
    }

    if (!isValidObjectId(questionId)) {
      throw new BusinessException(
        ErrorCode.QUESTION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUESTION_NOT_FOUND],
      );
    }

    const question = (exam.questions || []).find(
      (q) => q._id?.toString() === questionId || (q as any).id === questionId,
    );

    if (!question) {
      throw new BusinessException(
        ErrorCode.QUESTION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.QUESTION_NOT_FOUND],
      );
    }

    // Xoá file media trên Cloudflare R2 nếu có
    if (question.media?.url) {
      await this.uploadService.deleteFileByUrl(question.media.url);
    }

    const oldMediaSize = question.media?.sizeBytes || 0;
    const newTotal = Math.max(0, (exam.totalMediaSizeBytes || 0) - oldMediaSize);

    await this.examRepository.removeQuestionMedia(examId, questionId, newTotal);
  }
}
