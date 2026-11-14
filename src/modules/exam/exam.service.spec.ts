import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';
import { ExamService } from './exam.service';
import { ExamRepository } from './exam.repository';
import { Exam } from './entities/exam.entity';
import { ExamPrivacy, ExamSortOption, ExamTakeMode } from './enums/exam.enum';
import { QueryExamDto } from './dto/query-exam.dto';
import { GetExamQuestionsQueryDto } from './dto/get-exam-questions.dto';
import { SystemConfigService } from '../system-config/system-config.service';
import { UploadService } from '../upload/upload.service';
import { QuestionMediaType } from './enums/exam.enum';

describe('ExamService', () => {
  let service: ExamService;
  let repository: jest.Mocked<ExamRepository>;

  const mockExamModel = {};
  const mockExamRepository = {
    findWithPagination: jest.fn(),
    findMetadataById: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    countCreatedTodayByUser: jest.fn(),
    updateQuestionMedia: jest.fn(),
    removeQuestionMedia: jest.fn(),
  };

  const mockUploadService = {
    uploadSingleImage: jest.fn(),
    deleteFileByUrl: jest.fn(),
  };

  const mockSystemConfigService = {
    getPublicConfig: jest.fn().mockResolvedValue({
      guestPreviewMaxQuestions: 10,
      guestPreviewMaxPercent: 0.5,
    }),
    getDailyExamQuota: jest.fn().mockResolvedValue(5),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSystemConfigService.getPublicConfig.mockResolvedValue({
      guestPreviewMaxQuestions: 10,
      guestPreviewMaxPercent: 0.5,
    });
    mockSystemConfigService.getDailyExamQuota.mockResolvedValue(5);
    mockExamRepository.countCreatedTodayByUser.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamService,
        {
          provide: getModelToken(Exam.name),
          useValue: mockExamModel,
        },
        {
          provide: ExamRepository,
          useValue: mockExamRepository,
        },
        {
          provide: SystemConfigService,
          useValue: mockSystemConfigService,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    service = module.get<ExamService>(ExamService);
    repository = module.get(ExamRepository);
  });

  it('phải khởi tạo ExamService thành công', () => {
    expect(service).toBeDefined();
  });

  describe('findAllExams', () => {
    it('khách chưa đăng nhập: chỉ lấy đề có privacy = public', async () => {
      repository.findWithPagination.mockResolvedValue({
        items: [],
        total: 0,
      });

      const query = new QueryExamDto();
      await service.findAllExams(query, undefined);

      expect(repository.findWithPagination).toHaveBeenCalledTimes(1);
      const [filter, sort, skip, limit] = repository.findWithPagination.mock.calls[0];

      expect(filter).toEqual({
        $and: [{ deletedAt: null }, { privacy: ExamPrivacy.PUBLIC }],
      });
      expect(sort).toEqual({ createdAt: -1 });
      expect(skip).toBe(0);
      expect(limit).toBe(20);
    });

    it('người dùng đã đăng nhập: lấy đề public HOẶC đề của chính mình', async () => {
      repository.findWithPagination.mockResolvedValue({
        items: [],
        total: 0,
      });

      const currentUserId = new Types.ObjectId().toString();
      const query = new QueryExamDto();
      await service.findAllExams(query, currentUserId);

      expect(repository.findWithPagination).toHaveBeenCalledTimes(1);
      const [filter] = repository.findWithPagination.mock.calls[0];

      expect(filter).toEqual({
        $and: [
          { deletedAt: null },
          {
            $or: [
              { privacy: ExamPrivacy.PUBLIC },
              { createdBy: new Types.ObjectId(currentUserId) },
            ],
          },
        ],
      });
    });

    it('lọc theo createdBy = chính user hiện tại: trả cả đề private của chính họ', async () => {
      repository.findWithPagination.mockResolvedValue({
        items: [],
        total: 0,
      });

      const myId = new Types.ObjectId().toString();
      const query = new QueryExamDto();
      query.createdBy = myId;

      await service.findAllExams(query, myId);

      const [filter] = repository.findWithPagination.mock.calls[0];
      expect(filter).toEqual({
        $and: [{ deletedAt: null }, { createdBy: new Types.ObjectId(myId) }],
      });
      // Không có điều kiện privacy: ExamPrivacy.PUBLIC
    });

    it('lọc theo createdBy của người khác: chỉ trả đề public của người đó', async () => {
      repository.findWithPagination.mockResolvedValue({
        items: [],
        total: 0,
      });

      const myId = new Types.ObjectId().toString();
      const otherId = new Types.ObjectId().toString();
      const query = new QueryExamDto();
      query.createdBy = otherId;

      await service.findAllExams(query, myId);

      const [filter] = repository.findWithPagination.mock.calls[0];
      expect(filter).toEqual({
        $and: [
          { deletedAt: null },
          { createdBy: new Types.ObjectId(otherId), privacy: ExamPrivacy.PUBLIC },
        ],
      });
    });

    it('tìm kiếm theo q và tags và sort theo popular', async () => {
      repository.findWithPagination.mockResolvedValue({
        items: [],
        total: 0,
      });

      const query = new QueryExamDto();
      query.q = 'Toán 12';
      query.tags = 'toán, thi thử';
      query.sort = ExamSortOption.POPULAR;

      await service.findAllExams(query);

      const [filter, sort] = repository.findWithPagination.mock.calls[0];
      expect(sort).toEqual({ 'stats.attemptCount': -1, createdAt: -1 });

      // Có điều kiện regex và tags
      const conditions = (filter as any).$and;
      expect(conditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            $or: [
              { title: { $regex: expect.any(RegExp) } },
              { tags: { $in: [expect.any(RegExp)] } },
            ],
          }),
          expect.objectContaining({
            tags: { $in: ['toán', 'thi thử'] },
          }),
        ]),
      );
    });

    it('sắp xếp theo rating', async () => {
      repository.findWithPagination.mockResolvedValue({
        items: [],
        total: 0,
      });

      const query = new QueryExamDto();
      query.sort = ExamSortOption.RATING;

      await service.findAllExams(query);

      const [, sort] = repository.findWithPagination.mock.calls[0];
      expect(sort).toEqual({
        'stats.avgRating': -1,
        'stats.ratingCount': -1,
        createdAt: -1,
      });
    });
  });

  describe('getExamDetail', () => {
    it('ném lỗi 404 nếu examId không phải ObjectId hợp lệ', async () => {
      await expect(service.getExamDetail('invalid-id')).rejects.toThrow(BusinessException);
    });

    it('ném lỗi 404 nếu không tìm thấy đề thi', async () => {
      repository.findMetadataById.mockResolvedValue(null);
      const validId = new Types.ObjectId().toString();

      await expect(service.getExamDetail(validId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Không tìm thấy đề thi',
        ),
      );
    });

    it('trả về đề thi thành công nếu đề thi là public', async () => {
      const examId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi công khai',
        privacy: ExamPrivacy.PUBLIC,
      } as unknown as Exam;

      repository.findMetadataById.mockResolvedValue(mockExam);

      const result = await service.getExamDetail(examId);
      expect(result).toEqual(mockExam);
    });

    it('ném lỗi 403 nếu đề thi là private và không có token (khách)', async () => {
      const examId = new Types.ObjectId().toString();
      const ownerId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi riêng tư',
        privacy: ExamPrivacy.PRIVATE,
        createdBy: new Types.ObjectId(ownerId),
      } as unknown as Exam;

      repository.findMetadataById.mockResolvedValue(mockExam);

      await expect(service.getExamDetail(examId, undefined)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('ném lỗi 403 nếu đề thi là private và token không phải của tác giả', async () => {
      const examId = new Types.ObjectId().toString();
      const ownerId = new Types.ObjectId().toString();
      const strangerId = new Types.ObjectId().toString();

      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi riêng tư',
        privacy: ExamPrivacy.PRIVATE,
        createdBy: new Types.ObjectId(ownerId),
      } as unknown as Exam;

      repository.findMetadataById.mockResolvedValue(mockExam);

      await expect(service.getExamDetail(examId, strangerId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('cho phép xem đề private nếu token chính là của tác giả đề thi', async () => {
      const examId = new Types.ObjectId().toString();
      const ownerId = new Types.ObjectId().toString();

      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi riêng tư của tôi',
        privacy: ExamPrivacy.PRIVATE,
        createdBy: new Types.ObjectId(ownerId),
      } as unknown as Exam;

      repository.findMetadataById.mockResolvedValue(mockExam);

      const result = await service.getExamDetail(examId, ownerId);
      expect(result).toEqual(mockExam);
    });
  });

  describe('getExamQuestions', () => {
    const createMockQuestion = (order: number) => ({
      _id: new Types.ObjectId(),
      order,
      content: `Câu hỏi ${order}`,
      choices: [
        { key: 'A', text: 'Đáp án A' },
        { key: 'B', text: 'Đáp án B' },
      ],
      correctAnswerKey: 'A',
      explanation: 'Giải thích chi tiết cho câu hỏi',
      media: { type: 'none', url: null, sizeBytes: null },
      wrongCount: 2,
      answeredCount: 10,
    });

    it('Guest, đề public: ẩn correctAnswerKey và explanation', async () => {
      const examId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi THPT',
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto();
      const result = await service.getExamQuestions(examId, query, undefined);

      expect(result).toHaveLength(1);
      expect(result[0].correctAnswerKey).toBeUndefined();
      expect(result[0].explanation).toBeUndefined();
      expect(result[0].content).toBe('Câu hỏi 1');
    });

    it('Guest, đề public: giới hạn số lượng câu hỏi preview theo guestPreviewMaxQuestions và guestPreviewMaxPercent', async () => {
      const examId = new Types.ObjectId().toString();
      // Đề thi có 20 câu
      const mockQuestions = Array.from({ length: 20 }, (_, i) => createMockQuestion(i + 1));
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi 20 câu',
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: mockQuestions,
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      // Cấu hình: tối đa 5 câu hoặc 50% (50% của 20 = 10 -> min(5, 10) = 5)
      mockSystemConfigService.getPublicConfig.mockResolvedValue({
        guestPreviewMaxQuestions: 5,
        guestPreviewMaxPercent: 0.5,
      });

      const query = new GetExamQuestionsQueryDto();
      const result = await service.getExamQuestions(examId, query, undefined);

      expect(result).toHaveLength(5);
      expect(result[0].order).toBe(1);
      expect(result[4].order).toBe(5);
    });

    it('Guest, đề private: ném lỗi 403 Forbidden', async () => {
      const examId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi nội bộ',
        privacy: ExamPrivacy.PRIVATE,
        createdBy: new Types.ObjectId(),
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto();
      await expect(service.getExamQuestions(examId, query, undefined)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('User, đề public, mode=exam (làm bài thật): ẩn correctAnswerKey và explanation', async () => {
      const examId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi THPT',
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto();
      query.mode = ExamTakeMode.EXAM;
      const result = await service.getExamQuestions(examId, query, 'user-student-123');

      expect(result).toHaveLength(1);
      expect(result[0].correctAnswerKey).toBeUndefined();
      expect(result[0].explanation).toBeUndefined();
    });

    it('User, đề public, mode=practice (thi thử): trả cả correctAnswerKey và explanation', async () => {
      const examId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi THPT',
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto();
      query.mode = ExamTakeMode.PRACTICE;
      const result = await service.getExamQuestions(examId, query, 'user-student-123');

      expect(result).toHaveLength(1);
      expect(result[0].correctAnswerKey).toBe('A');
      expect(result[0].explanation).toBe('Giải thích chi tiết cho câu hỏi');
    });

    it('User không phải chủ đề, đề private: ném lỗi 403 Forbidden', async () => {
      const examId = new Types.ObjectId().toString();
      const ownerId = new Types.ObjectId().toString();
      const strangerId = new Types.ObjectId().toString();

      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi riêng tư',
        privacy: ExamPrivacy.PRIVATE,
        createdBy: new Types.ObjectId(ownerId),
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto();
      await expect(service.getExamQuestions(examId, query, strangerId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('User là chủ đề, đề private: trả toàn bộ kể cả đáp án đúng và giải thích (chế độ xem/sửa)', async () => {
      const examId = new Types.ObjectId().toString();
      const ownerId = new Types.ObjectId().toString();

      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi riêng tư của tôi',
        privacy: ExamPrivacy.PRIVATE,
        createdBy: new Types.ObjectId(ownerId),
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto(); // Không truyền mode thi -> chế độ xem/sửa
      const result = await service.getExamQuestions(examId, query, ownerId);

      expect(result).toHaveLength(1);
      expect(result[0].correctAnswerKey).toBe('A');
      expect(result[0].explanation).toBe('Giải thích chi tiết cho câu hỏi');
    });

    it('ném lỗi 400 nếu truyền mode=practice nhưng practiceModeEnabled = false', async () => {
      const examId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi',
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: false,
        examModeEnabled: true,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto();
      query.mode = ExamTakeMode.PRACTICE;

      await expect(service.getExamQuestions(examId, query, 'user-123')).rejects.toThrow(
        BusinessException,
      );
    });

    it('ném lỗi 400 nếu truyền mode=exam nhưng examModeEnabled = false', async () => {
      const examId = new Types.ObjectId().toString();
      const mockExam = {
        _id: new Types.ObjectId(examId),
        title: 'Đề thi',
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: true,
        examModeEnabled: false,
        questions: [createMockQuestion(1)],
      } as unknown as Exam;

      repository.findById.mockResolvedValue(mockExam);

      const query = new GetExamQuestionsQueryDto();
      query.mode = ExamTakeMode.EXAM;

      await expect(service.getExamQuestions(examId, query, 'user-123')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('createExam', () => {
    const userId = new Types.ObjectId().toString();

    it('ném lỗi 429 DAILY_QUOTA_EXCEEDED nếu số lượng đề tạo hôm nay đạt giới hạn quota', async () => {
      mockSystemConfigService.getDailyExamQuota.mockResolvedValue(5);
      mockExamRepository.countCreatedTodayByUser.mockResolvedValue(5);

      const dto = {
        title: 'Kinh tế vi mô - Chương 3',
        tags: ['kinhtevimo'],
        privacy: ExamPrivacy.PUBLIC,
      };

      await expect(service.createExam(dto as any, userId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.DAILY_QUOTA_EXCEEDED,
          HttpStatus.TOO_MANY_REQUESTS,
          'Bạn đã vượt quá giới hạn số lượng tạo đề thi trong ngày',
        ),
      );
    });

    it('ném lỗi 400 INVALID_TITLE nếu tiêu đề để trống hoặc chỉ có khoảng trắng', async () => {
      mockExamRepository.countCreatedTodayByUser.mockResolvedValue(1);

      const dto = {
        title: '   ',
        tags: ['toan'],
      };

      await expect(service.createExam(dto as any, userId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.INVALID_TITLE,
          HttpStatus.BAD_REQUEST,
          'Tiêu đề đề thi không được để trống và tối đa 150 ký tự',
        ),
      );
    });

    it('ném lỗi 400 INVALID_TITLE nếu tiêu đề vượt quá 150 ký tự', async () => {
      mockExamRepository.countCreatedTodayByUser.mockResolvedValue(1);

      const dto = {
        title: 'a'.repeat(151),
        tags: ['toan'],
      };

      await expect(service.createExam(dto as any, userId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.INVALID_TITLE,
          HttpStatus.BAD_REQUEST,
          'Tiêu đề đề thi không được để trống và tối đa 150 ký tự',
        ),
      );
    });

    it('ném lỗi 400 AT_LEAST_ONE_MODE_REQUIRED nếu cả hai chế độ đều bị tắt (false)', async () => {
      mockExamRepository.countCreatedTodayByUser.mockResolvedValue(0);

      const dto = {
        title: 'Kinh tế vi mô - Chương 3',
        practiceModeEnabled: false,
        examModeEnabled: false,
      };

      await expect(service.createExam(dto as any, userId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.AT_LEAST_ONE_MODE_REQUIRED,
          HttpStatus.BAD_REQUEST,
          'Đề thi phải bật ít nhất 1 chế độ: Thi thử hoặc Làm bài thật',
        ),
      );
    });

    it('ném lỗi 400 INVALID_CORRECT_ANSWER nếu correctAnswerKey không khớp với bất kỳ choice nào', async () => {
      mockExamRepository.countCreatedTodayByUser.mockResolvedValue(0);

      const dto = {
        title: 'Kinh tế vi mô - Chương 3',
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [
          {
            content: 'Câu hỏi 1',
            choices: [
              { key: 'A', text: 'Đáp án A' },
              { key: 'B', text: 'Đáp án B' },
            ],
            correctAnswerKey: 'C', // C không nằm trong A, B
          },
        ],
      };

      await expect(service.createExam(dto as any, userId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.INVALID_CORRECT_ANSWER,
          HttpStatus.BAD_REQUEST,
          'Đáp án đúng phải khớp với một trong các lựa chọn đáp án',
        ),
      );
    });

    it('tạo đề thi thành công khi thông tin hợp lệ', async () => {
      mockExamRepository.countCreatedTodayByUser.mockResolvedValue(2);
      mockExamRepository.create.mockImplementation((data: any) =>
        Promise.resolve({ ...data, _id: new Types.ObjectId(), id: 'exam-1' }),
      );

      const dto = {
        title: 'Kinh tế vi mô - Chương 3',
        tags: ['kinhtevimo', 'daihoc'],
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [
          {
            content: 'Nội dung câu 1',
            choices: [
              { key: 'A', text: 'Lựa chọn A' },
              { key: 'B', text: 'Lựa chọn B' },
            ],
            correctAnswerKey: 'B',
            explanation: 'Giải thích câu 1',
          },
        ],
      };

      const result = await service.createExam(dto as any, userId);

      expect(mockExamRepository.create).toHaveBeenCalledTimes(1);
      const createdData = mockExamRepository.create.mock.calls[0][0];

      expect(createdData.title).toBe('Kinh tế vi mô - Chương 3');
      expect(createdData.createdBy).toEqual(new Types.ObjectId(userId));
      expect(createdData.totalQuestions).toBe(1);
      expect(createdData.questions[0].correctAnswerKey).toBe('B');
      expect(createdData.questions[0].order).toBe(1);
      expect(result).toBeDefined();
    });
  });

  describe('updateExam', () => {
    const ownerId = new Types.ObjectId().toString();
    const strangerId = new Types.ObjectId().toString();
    const examId = new Types.ObjectId().toString();

    it('ném lỗi 404 nếu examId không hợp lệ', async () => {
      await expect(service.updateExam('invalid-id', {}, ownerId)).rejects.toThrow(
        BusinessException,
      );
    });

    it('ném lỗi 404 nếu không tìm thấy đề thi', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.updateExam(examId, {}, ownerId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Không tìm thấy đề thi',
        ),
      );
    });

    it('ném lỗi 403 nếu user không phải là chủ đề', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
      } as any);

      await expect(service.updateExam(examId, {}, strangerId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('ném lỗi 400 INVALID_TITLE nếu cập nhật tiêu đề rỗng', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
        practiceModeEnabled: true,
        examModeEnabled: true,
      } as any);

      await expect(service.updateExam(examId, { title: '' }, ownerId)).rejects.toThrow(
        BusinessException,
      );
    });

    it('ném lỗi 400 AT_LEAST_ONE_MODE_REQUIRED nếu cập nhật tắt cả 2 chế độ', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
        practiceModeEnabled: true,
        examModeEnabled: true,
      } as any);

      await expect(
        service.updateExam(examId, { practiceModeEnabled: false, examModeEnabled: false }, ownerId),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.AT_LEAST_ONE_MODE_REQUIRED,
          HttpStatus.BAD_REQUEST,
          'Đề thi phải bật ít nhất 1 chế độ: Thi thử hoặc Làm bài thật',
        ),
      );
    });

    it('cập nhật đề thi thành công', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
        practiceModeEnabled: true,
        examModeEnabled: true,
      } as any);

      const mockUpdated = {
        _id: new Types.ObjectId(examId),
        title: 'Tiêu đề mới',
      };
      repository.update.mockResolvedValue(mockUpdated as any);

      const result = await service.updateExam(examId, { title: 'Tiêu đề mới' }, ownerId);

      expect(repository.update).toHaveBeenCalledWith(
        examId,
        expect.objectContaining({ title: 'Tiêu đề mới' }),
      );
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('updatePrivacy', () => {
    const ownerId = new Types.ObjectId().toString();
    const strangerId = new Types.ObjectId().toString();
    const examId = new Types.ObjectId().toString();

    it('ném lỗi 403 nếu user không phải là chủ đề', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
      } as any);

      await expect(service.updatePrivacy(examId, ExamPrivacy.PRIVATE, strangerId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('cập nhật quyền riêng tư thành công khi là chủ đề', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
      } as any);

      const mockUpdated = {
        _id: new Types.ObjectId(examId),
        privacy: ExamPrivacy.PRIVATE,
      };
      repository.update.mockResolvedValue(mockUpdated as any);

      const result = await service.updatePrivacy(examId, ExamPrivacy.PRIVATE, ownerId);

      expect(repository.update).toHaveBeenCalledWith(examId, {
        privacy: ExamPrivacy.PRIVATE,
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('deleteExam', () => {
    const ownerId = new Types.ObjectId().toString();
    const strangerId = new Types.ObjectId().toString();
    const examId = new Types.ObjectId().toString();

    it('ném lỗi 403 nếu người xoá không phải chủ đề và cũng không phải admin', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
      } as any);

      await expect(service.deleteExam(examId, { sub: strangerId, role: 'user' })).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('cho phép chủ đề xoá thành công', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
      } as any);

      repository.softDelete.mockResolvedValue(true);

      await service.deleteExam(examId, { sub: ownerId, role: 'user' });

      expect(repository.softDelete).toHaveBeenCalledWith(examId);
    });

    it('cho phép admin xoá đề của bất kỳ ai', async () => {
      repository.findById.mockResolvedValue({
        _id: new Types.ObjectId(examId),
        createdBy: new Types.ObjectId(ownerId),
      } as any);

      repository.softDelete.mockResolvedValue(true);

      await service.deleteExam(examId, { sub: strangerId, role: 'admin' });

      expect(repository.softDelete).toHaveBeenCalledWith(examId);
    });
  });

  describe('findMyExams', () => {
    it('gọi findAllExams với createdBy là chính user', async () => {
      const myId = new Types.ObjectId().toString();
      const spy = jest.spyOn(service, 'findAllExams').mockResolvedValue({} as any);

      const query = new QueryExamDto();
      await service.findMyExams(query, myId);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ createdBy: myId }), myId);
    });
  });

  describe('uploadQuestionMedia', () => {
    const ownerId = new Types.ObjectId().toString();
    const strangerId = new Types.ObjectId().toString();
    const examId = new Types.ObjectId().toString();
    const questionId = new Types.ObjectId().toString();

    const mockQuestion = {
      _id: new Types.ObjectId(questionId),
      order: 1,
      content: 'Câu hỏi test',
      media: {
        type: QuestionMediaType.NONE,
        url: null,
        sizeBytes: null,
      },
    };

    const mockExam = {
      _id: new Types.ObjectId(examId),
      createdBy: new Types.ObjectId(ownerId),
      totalMediaSizeBytes: 1000,
      questions: [mockQuestion],
    };

    beforeEach(() => {
      mockSystemConfigService.getPublicConfig.mockResolvedValue({
        maxImageSizeBytes: 2 * 1024 * 1024,
        maxAudioSizeBytes: 5 * 1024 * 1024,
        maxAudioDurationSeconds: 120,
        maxTotalMediaSizePerExam: 50 * 1024 * 1024,
        guestPreviewMaxQuestions: 10,
        guestPreviewMaxPercent: 0.5,
      });
      mockUploadService.uploadSingleImage.mockResolvedValue({
        url: 'https://cdn.example.com/uploaded.png',
        key: 'exams/uploaded.png',
      });
    });

    it('ném lỗi 404 EXAM_NOT_FOUND nếu examId không hợp lệ hoặc không tìm thấy đề', async () => {
      repository.findById.mockResolvedValue(null);

      const file = {
        originalname: 'img.png',
        mimetype: 'image/png',
        buffer: Buffer.from('abc'),
        size: 100,
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          file,
          { type: QuestionMediaType.IMAGE },
          ownerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Không tìm thấy đề thi',
        ),
      );
    });

    it('ném lỗi 403 EXAM_FORBIDDEN nếu không phải chủ đề', async () => {
      repository.findById.mockResolvedValue(mockExam as any);

      const file = {
        originalname: 'img.png',
        mimetype: 'image/png',
        buffer: Buffer.from('abc'),
        size: 100,
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          file,
          { type: QuestionMediaType.IMAGE },
          strangerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_FORBIDDEN,
          HttpStatus.FORBIDDEN,
          'Bạn không có quyền truy cập đề thi này',
        ),
      );
    });

    it('ném lỗi 404 QUESTION_NOT_FOUND nếu không tìm thấy câu hỏi trong đề', async () => {
      repository.findById.mockResolvedValue(mockExam as any);
      const wrongQuestionId = new Types.ObjectId().toString();

      const file = {
        originalname: 'img.png',
        mimetype: 'image/png',
        buffer: Buffer.from('abc'),
        size: 100,
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          wrongQuestionId,
          file,
          { type: QuestionMediaType.IMAGE },
          ownerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.QUESTION_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Không tìm thấy câu hỏi trong đề thi',
        ),
      );
    });

    it('ném lỗi 400 INVALID_FILE_TYPE nếu định dạng file không hợp lệ (không phải jpg/png/webp hoặc mp3)', async () => {
      repository.findById.mockResolvedValue(mockExam as any);

      // File pdf
      const pdfFile = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('abc'),
        size: 100,
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          pdfFile,
          { type: QuestionMediaType.IMAGE },
          ownerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.INVALID_FILE_TYPE,
          HttpStatus.BAD_REQUEST,
          'Định dạng file không hợp lệ (chỉ chấp nhận jpg, png, webp hoặc mp3)',
        ),
      );

      // File mp3 nhưng chọn type là image
      const mp3AsImage = {
        originalname: 'song.mp3',
        mimetype: 'audio/mpeg',
        buffer: Buffer.from('abc'),
        size: 100,
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          mp3AsImage,
          { type: QuestionMediaType.IMAGE },
          ownerId,
        ),
      ).rejects.toThrow(BusinessException);
    });

    it('ném lỗi 413 IMAGE_TOO_LARGE nếu ảnh > 2MB', async () => {
      repository.findById.mockResolvedValue(mockExam as any);

      const largeImage = {
        originalname: 'large.png',
        mimetype: 'image/png',
        buffer: Buffer.from('abc'),
        size: 3 * 1024 * 1024, // 3MB > 2MB
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          largeImage,
          { type: QuestionMediaType.IMAGE },
          ownerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.IMAGE_TOO_LARGE,
          HttpStatus.PAYLOAD_TOO_LARGE,
          'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 2MB)',
        ),
      );
    });

    it('ném lỗi 413 AUDIO_LIMIT_EXCEEDED nếu audio > 5MB', async () => {
      repository.findById.mockResolvedValue(mockExam as any);

      const largeAudio = {
        originalname: 'large.mp3',
        mimetype: 'audio/mpeg',
        buffer: Buffer.from('abc'),
        size: 6 * 1024 * 1024, // 6MB > 5MB
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          largeAudio,
          { type: QuestionMediaType.AUDIO },
          ownerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.AUDIO_LIMIT_EXCEEDED,
          HttpStatus.PAYLOAD_TOO_LARGE,
          'Dung lượng audio vượt quá 5MB hoặc thời lượng vượt quá 2 phút',
        ),
      );
    });

    it('ném lỗi 413 AUDIO_LIMIT_EXCEEDED nếu audio có thời lượng > 2 phút (120s)', async () => {
      repository.findById.mockResolvedValue(mockExam as any);

      const longAudio = {
        originalname: 'long.mp3',
        mimetype: 'audio/mpeg',
        buffer: Buffer.from('abc'),
        size: 1 * 1024 * 1024,
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          longAudio,
          { type: QuestionMediaType.AUDIO, durationSeconds: 150 }, // 150s > 120s
          ownerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.AUDIO_LIMIT_EXCEEDED,
          HttpStatus.PAYLOAD_TOO_LARGE,
          'Dung lượng audio vượt quá 5MB hoặc thời lượng vượt quá 2 phút',
        ),
      );
    });

    it('ném lỗi 413 EXAM_MEDIA_QUOTA_EXCEEDED nếu tổng dung lượng media đề thi vượt quá 50MB', async () => {
      const nearFullExam = {
        ...mockExam,
        totalMediaSizeBytes: 49 * 1024 * 1024, // 49MB
      };
      repository.findById.mockResolvedValue(nearFullExam as any);

      const newImage = {
        originalname: 'img.png',
        mimetype: 'image/png',
        buffer: Buffer.from('abc'),
        size: 1.5 * 1024 * 1024, // 1.5MB -> Tổng 50.5MB > 50MB
      } as Express.Multer.File;

      await expect(
        service.uploadQuestionMedia(
          examId,
          questionId,
          newImage,
          { type: QuestionMediaType.IMAGE },
          ownerId,
        ),
      ).rejects.toThrow(
        new BusinessException(
          ErrorCode.EXAM_MEDIA_QUOTA_EXCEEDED,
          HttpStatus.PAYLOAD_TOO_LARGE,
          'Tổng dung lượng media của đề thi vượt quá giới hạn 50MB',
        ),
      );
    });

    it('upload ảnh thành công và cập nhật media của câu hỏi', async () => {
      repository.findById.mockResolvedValue(mockExam as any);
      repository.updateQuestionMedia.mockResolvedValue({} as any);

      const validImage = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('image-content'),
        size: 500000,
      } as Express.Multer.File;

      const result = await service.uploadQuestionMedia(
        examId,
        questionId,
        validImage,
        { type: QuestionMediaType.IMAGE },
        ownerId,
      );

      expect(mockUploadService.uploadSingleImage).toHaveBeenCalledWith(validImage, {
        folder: 'exams',
      });
      expect(repository.updateQuestionMedia).toHaveBeenCalledWith(
        examId,
        questionId,
        {
          type: QuestionMediaType.IMAGE,
          url: 'https://cdn.example.com/uploaded.png',
          sizeBytes: 500000,
        },
        1000 + 500000,
      );
      expect(result).toEqual({
        url: 'https://cdn.example.com/uploaded.png',
        sizeBytes: 500000,
        type: QuestionMediaType.IMAGE,
      });
    });

    it('upload audio thành công và xoá file media cũ trên R2 nếu câu hỏi đã có media trước đó', async () => {
      const examWithExistingMedia = {
        ...mockExam,
        totalMediaSizeBytes: 200000,
        questions: [
          {
            ...mockQuestion,
            media: {
              type: QuestionMediaType.IMAGE,
              url: 'https://cdn.example.com/old-image.png',
              sizeBytes: 100000,
            },
          },
        ],
      };
      repository.findById.mockResolvedValue(examWithExistingMedia as any);
      repository.updateQuestionMedia.mockResolvedValue({} as any);
      mockUploadService.uploadSingleImage.mockResolvedValue({
        url: 'https://cdn.example.com/new-audio.mp3',
        key: 'exams/new-audio.mp3',
      });

      const audioFile = {
        originalname: 'voice.mp3',
        mimetype: 'audio/mpeg',
        buffer: Buffer.from('mp3-content'),
        size: 200000,
      } as Express.Multer.File;

      const result = await service.uploadQuestionMedia(
        examId,
        questionId,
        audioFile,
        { type: QuestionMediaType.AUDIO, durationSeconds: 60 },
        ownerId,
      );

      expect(mockUploadService.deleteFileByUrl).toHaveBeenCalledWith(
        'https://cdn.example.com/old-image.png',
      );
      expect(mockUploadService.uploadSingleImage).toHaveBeenCalledWith(audioFile, {
        folder: 'exams',
      });
      // newTotal = 200000 - 100000 + 200000 = 300000
      expect(repository.updateQuestionMedia).toHaveBeenCalledWith(
        examId,
        questionId,
        {
          type: QuestionMediaType.AUDIO,
          url: 'https://cdn.example.com/new-audio.mp3',
          sizeBytes: 200000,
        },
        300000,
      );
      expect(result).toEqual({
        url: 'https://cdn.example.com/new-audio.mp3',
        sizeBytes: 200000,
        type: QuestionMediaType.AUDIO,
      });
    });
  });

  describe('deleteQuestionMedia', () => {
    const ownerId = new Types.ObjectId().toString();
    const strangerId = new Types.ObjectId().toString();
    const examId = new Types.ObjectId().toString();
    const questionId = new Types.ObjectId().toString();

    const mockExamWithMedia = {
      _id: new Types.ObjectId(examId),
      createdBy: new Types.ObjectId(ownerId),
      totalMediaSizeBytes: 300000,
      questions: [
        {
          _id: new Types.ObjectId(questionId),
          media: {
            type: QuestionMediaType.IMAGE,
            url: 'https://cdn.example.com/photo.png',
            sizeBytes: 200000,
          },
        },
      ],
    };

    it('ném lỗi 403 EXAM_FORBIDDEN nếu không phải chủ đề', async () => {
      repository.findById.mockResolvedValue(mockExamWithMedia as any);

      await expect(service.deleteQuestionMedia(examId, questionId, strangerId)).rejects.toThrow(
        BusinessException,
      );
    });

    it('ném lỗi 404 QUESTION_NOT_FOUND nếu không tìm thấy câu hỏi trong đề', async () => {
      repository.findById.mockResolvedValue(mockExamWithMedia as any);
      const wrongId = new Types.ObjectId().toString();

      await expect(service.deleteQuestionMedia(examId, wrongId, ownerId)).rejects.toThrow(
        new BusinessException(
          ErrorCode.QUESTION_NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'Không tìm thấy câu hỏi trong đề thi',
        ),
      );
    });

    it('xoá file media thành công và cập nhật lại totalMediaSizeBytes', async () => {
      repository.findById.mockResolvedValue(mockExamWithMedia as any);
      repository.removeQuestionMedia.mockResolvedValue({} as any);

      await service.deleteQuestionMedia(examId, questionId, ownerId);

      expect(mockUploadService.deleteFileByUrl).toHaveBeenCalledWith(
        'https://cdn.example.com/photo.png',
      );
      // newTotal = 300000 - 200000 = 100000
      expect(repository.removeQuestionMedia).toHaveBeenCalledWith(examId, questionId, 100000);
    });
  });
});
