import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { PracticeSessionService } from './practice-session.service';
import { PracticeSessionRepository } from './practice-session.repository';
import { Exam } from '@modules/exam/entities/exam.entity';
import { ExamPrivacy, ExamTakeMode } from '@modules/exam/enums/exam.enum';
import { PracticeSessionStatus } from './enums/practice-session.enum';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

describe('PracticeSessionService', () => {
  let service: PracticeSessionService;
  let repository: jest.Mocked<PracticeSessionRepository>;

  const mockExamModel = {
    findOne: jest.fn(),
  };

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findWithPagination: jest.fn(),
  };

  const userId = new Types.ObjectId().toString();
  const examId = new Types.ObjectId().toString();
  const q1Id = new Types.ObjectId();
  const q2Id = new Types.ObjectId();
  const q3Id = new Types.ObjectId();

  const mockExamQuestions = [
    {
      _id: q1Id,
      order: 1,
      content: 'Câu 1',
      choices: [
        { key: 'A', text: 'Đáp án A' },
        { key: 'B', text: 'Đáp án B' },
      ],
      correctAnswerKey: 'B',
      explanation: 'Giải thích câu 1',
      wrongCount: 0,
      answeredCount: 0,
    },
    {
      _id: q2Id,
      order: 2,
      content: 'Câu 2',
      choices: [
        { key: 'A', text: 'Đáp án A' },
        { key: 'B', text: 'Đáp án B' },
      ],
      correctAnswerKey: 'A',
      explanation: 'Giải thích câu 2',
      wrongCount: 1,
      answeredCount: 2,
    },
    {
      _id: q3Id,
      order: 3,
      content: 'Câu 3',
      choices: [
        { key: 'A', text: 'Đáp án A' },
        { key: 'B', text: 'Đáp án B' },
      ],
      correctAnswerKey: 'B',
      explanation: 'Giải thích câu 3',
      wrongCount: 0,
      answeredCount: 1,
    },
  ];

  const buildMockExam = (overrides = {}) => ({
    _id: new Types.ObjectId(examId),
    title: 'Kinh tế vi mô',
    createdBy: new Types.ObjectId(userId),
    privacy: ExamPrivacy.PUBLIC,
    practiceModeEnabled: true,
    examModeEnabled: true,
    totalQuestions: 3,
    stats: {
      attemptCount: 1,
      avgScore: 8.0,
      avgRating: 0,
      ratingCount: 0,
    },
    questions: JSON.parse(JSON.stringify(mockExamQuestions)).map((q: any) => ({
      ...q,
      _id: new Types.ObjectId(q._id),
    })),
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeSessionService,
        {
          provide: getModelToken(Exam.name),
          useValue: mockExamModel,
        },
        {
          provide: PracticeSessionRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PracticeSessionService>(PracticeSessionService);
    repository = module.get(PracticeSessionRepository);
  });

  it('phải khởi tạo PracticeSessionService thành công', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('ném lỗi EXAM_NOT_FOUND nếu examId không phải ObjectId hợp lệ', async () => {
      await expect(
        service.startSession('invalid-id', { mode: ExamTakeMode.PRACTICE }, userId),
      ).rejects.toThrow(BusinessException);
    });

    it('ném lỗi EXAM_NOT_FOUND nếu không tìm thấy đề thi', async () => {
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.startSession(examId, { mode: ExamTakeMode.PRACTICE }, userId),
      ).rejects.toThrow(BusinessException);
    });

    it('ném lỗi EXAM_FORBIDDEN nếu đề thi private và user không phải chủ sở hữu', async () => {
      const mockExam = buildMockExam({
        privacy: ExamPrivacy.PRIVATE,
        createdBy: new Types.ObjectId(),
      });
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      await expect(
        service.startSession(examId, { mode: ExamTakeMode.PRACTICE }, userId),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.EXAM_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('ném lỗi 403 MODE_NOT_ALLOWED nếu mode=practice nhưng exam.practiceModeEnabled=false', async () => {
      const mockExam = buildMockExam({ practiceModeEnabled: false });
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      await expect(
        service.startSession(examId, { mode: ExamTakeMode.PRACTICE }, userId),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.MODE_NOT_ALLOWED,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('ném lỗi 403 MODE_NOT_ALLOWED nếu mode=exam nhưng exam.examModeEnabled=false', async () => {
      const mockExam = buildMockExam({ examModeEnabled: false });
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      await expect(
        service.startSession(examId, { mode: ExamTakeMode.EXAM }, userId),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.MODE_NOT_ALLOWED,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('tạo session mới thành công với roundNumber=1 và score.total = số câu hỏi', async () => {
      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const createdSession = {
        _id: new Types.ObjectId(),
        examId: mockExam._id,
        userId: new Types.ObjectId(userId),
        mode: ExamTakeMode.PRACTICE,
        roundNumber: 1,
        parentSessionId: null,
        score: { correct: 0, total: 3 },
        answers: [],
        status: PracticeSessionStatus.IN_PROGRESS,
      };
      mockRepository.create.mockResolvedValue(createdSession as any);

      const result = await service.startSession(examId, { mode: ExamTakeMode.PRACTICE }, userId);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roundNumber: 1,
          parentSessionId: null,
          mode: ExamTakeMode.PRACTICE,
          status: PracticeSessionStatus.IN_PROGRESS,
          score: { correct: 0, total: 3 },
        }),
      );
      expect(result).toEqual(createdSession);
    });
  });

  describe('submitAnswer', () => {
    it('ném lỗi PRACTICE_SESSION_NOT_FOUND nếu không tìm thấy session', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.submitAnswer(
          new Types.ObjectId().toString(),
          { questionId: q1Id.toString(), selectedKey: 'B' },
          userId,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.PRACTICE_SESSION_NOT_FOUND,
      });
    });

    it('ném lỗi 403 FORBIDDEN nếu user không phải chủ sở hữu của session', async () => {
      const otherUserId = new Types.ObjectId();
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: otherUserId,
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      await expect(
        service.submitAnswer(
          new Types.ObjectId().toString(),
          { questionId: q1Id.toString(), selectedKey: 'B' },
          userId,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('ném lỗi SESSION_ALREADY_COMPLETED nếu session đã completed', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.COMPLETED,
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      await expect(
        service.submitAnswer(
          new Types.ObjectId().toString(),
          { questionId: q1Id.toString(), selectedKey: 'B' },
          userId,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.SESSION_ALREADY_COMPLETED,
      });
    });

    it('ném lỗi QUESTION_NOT_FOUND nếu câu hỏi không có trong đề thi', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.IN_PROGRESS,
        examId: new Types.ObjectId(examId),
        answers: [],
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      await expect(
        service.submitAnswer(
          new Types.ObjectId().toString(),
          { questionId: new Types.ObjectId().toString(), selectedKey: 'A' },
          userId,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.QUESTION_NOT_FOUND,
      });
    });

    it('mode=practice: trả ngay isCorrect=true và explanation khi trả lời đúng', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.IN_PROGRESS,
        mode: ExamTakeMode.PRACTICE,
        examId: new Types.ObjectId(examId),
        roundNumber: 1,
        answers: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const result = await service.submitAnswer(
        mockSession._id.toString(),
        { questionId: q1Id.toString(), selectedKey: 'B' },
        userId,
      );

      expect(result).toEqual({
        isCorrect: true,
        explanation: 'Giải thích câu 1',
      });
      expect(mockSession.answers).toHaveLength(1);
      expect(mockSession.answers[0]).toMatchObject({
        questionId: q1Id,
        selectedKey: 'B',
        isCorrect: true,
      });
      expect(mockSession.save).toHaveBeenCalled();
    });

    it('mode=exam: chỉ trả { saved: true }, ẩn hoàn toàn isCorrect và explanation', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.IN_PROGRESS,
        mode: ExamTakeMode.EXAM,
        examId: new Types.ObjectId(examId),
        roundNumber: 1,
        answers: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const result = await service.submitAnswer(
        mockSession._id.toString(),
        { questionId: q1Id.toString(), selectedKey: 'B' },
        userId,
      );

      expect(result).toEqual({ saved: true });
      expect((result as any).isCorrect).toBeUndefined();
      expect((result as any).explanation).toBeUndefined();
      expect(mockSession.answers).toHaveLength(1);
    });

    it('ghi đè đáp án khi nộp lại câu hỏi đã trả lời trước đó', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.IN_PROGRESS,
        mode: ExamTakeMode.PRACTICE,
        examId: new Types.ObjectId(examId),
        roundNumber: 1,
        answers: [
          {
            questionId: q1Id,
            selectedKey: 'A',
            isCorrect: false,
            answeredAt: new Date(),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const result = await service.submitAnswer(
        mockSession._id.toString(),
        { questionId: q1Id.toString(), selectedKey: 'B' },
        userId,
      );

      expect(result).toEqual({
        isCorrect: true,
        explanation: 'Giải thích câu 1',
      });
      expect(mockSession.answers).toHaveLength(1);
      expect(mockSession.answers[0].selectedKey).toBe('B');
      expect(mockSession.answers[0].isCorrect).toBe(true);
    });
  });

  describe('submitSession', () => {
    it('tính đúng điểm số, set completed, finishedAt, và cập nhật exams.stats', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.IN_PROGRESS,
        mode: ExamTakeMode.EXAM,
        roundNumber: 1,
        examId: new Types.ObjectId(examId),
        score: { correct: 0, total: 3 },
        answers: [
          { questionId: q1Id, selectedKey: 'B', isCorrect: true },
          { questionId: q2Id, selectedKey: 'B', isCorrect: false },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam({
        stats: {
          attemptCount: 1,
          avgScore: 5.0,
          avgRating: 0,
          ratingCount: 0,
        },
      });
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const result = await service.submitSession(mockSession._id.toString(), userId);

      // Score: 1 correct out of 3 total -> 1 / 3 * 10 = 3.33
      expect(result.score.correct).toBe(1);
      expect(result.score.total).toBe(3);
      expect(result.status).toBe(PracticeSessionStatus.COMPLETED);
      expect(result.finishedAt).toBeInstanceOf(Date);
      // roundNumber=1 và mode=exam -> ghi nhận vào lịch sử chính thức
      expect(result.isOfficial).toBe(true);

      // exam stats: attemptCount tăng từ 1 lên 2, avgScore = (5.0 * 1 + 3.33) / 2 = 4.17
      expect(mockExam.stats.attemptCount).toBe(2);
      expect(mockExam.stats.avgScore).toBe(4.17);

      // questions counters:
      // q1: answeredCount tăng 1
      const q1 = mockExam.questions.find((q: any) => q._id.toString() === q1Id.toString());
      expect(q1.answeredCount).toBe(1);
      expect(q1.wrongCount).toBe(0);

      // q2: answeredCount tăng 1 (từ 2 lên 3), wrongCount tăng 1 (từ 1 lên 2)
      const q2 = mockExam.questions.find((q: any) => q._id.toString() === q2Id.toString());
      expect(q2.answeredCount).toBe(3);
      expect(q2.wrongCount).toBe(2);

      expect(mockExam.save).toHaveBeenCalled();
      expect(mockSession.save).toHaveBeenCalled();
    });

    it('roundNumber=1 nhưng mode=practice thì không đánh dấu isOfficial', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.IN_PROGRESS,
        mode: ExamTakeMode.PRACTICE,
        roundNumber: 1,
        examId: new Types.ObjectId(examId),
        score: { correct: 0, total: 3 },
        answers: [{ questionId: q1Id, selectedKey: 'B', isCorrect: true }],
        save: jest.fn().mockResolvedValue(true),
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const result = await service.submitSession(mockSession._id.toString(), userId);

      expect(result.isOfficial).toBeFalsy();
    });

    it('nộp bài kèm batch answers: lưu tất cả câu trả lời và tính điểm chính xác', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        status: PracticeSessionStatus.IN_PROGRESS,
        mode: ExamTakeMode.PRACTICE,
        roundNumber: 1,
        examId: new Types.ObjectId(examId),
        score: { correct: 0, total: 3 },
        answers: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const batchDto = {
        answers: [
          { questionId: q1Id.toString(), selectedKey: 'B' }, // q1 correct is 'B' -> true
          { questionId: q2Id.toString(), selectedKey: 'B' }, // q2 correct is 'A' -> false
        ],
      };

      const result = await service.submitSession(mockSession._id.toString(), userId, batchDto);

      expect(result.score.correct).toBe(1);
      expect(result.answers).toHaveLength(2);
      expect(result.answers[0].isCorrect).toBe(true);
      expect(result.answers[1].isCorrect).toBe(false);
      expect(result.status).toBe(PracticeSessionStatus.COMPLETED);
    });
  });

  describe('retryWrong', () => {
    it('ném lỗi CANNOT_RETRY_SESSION nếu session mode !== practice', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        mode: ExamTakeMode.EXAM,
        status: PracticeSessionStatus.COMPLETED,
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      await expect(service.retryWrong(mockSession._id.toString(), userId)).rejects.toMatchObject({
        errorCode: ErrorCode.CANNOT_RETRY_SESSION,
      });
    });

    it('ném lỗi CANNOT_RETRY_SESSION nếu session chưa hoàn thành (status=in_progress)', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        mode: ExamTakeMode.PRACTICE,
        status: PracticeSessionStatus.IN_PROGRESS,
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      await expect(service.retryWrong(mockSession._id.toString(), userId)).rejects.toMatchObject({
        errorCode: ErrorCode.CANNOT_RETRY_SESSION,
      });
    });

    it('ném lỗi CANNOT_RETRY_SESSION nếu user đã trả lời đúng tất cả các câu hỏi', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        mode: ExamTakeMode.PRACTICE,
        status: PracticeSessionStatus.COMPLETED,
        roundNumber: 1,
        examId: new Types.ObjectId(examId),
        answers: [
          { questionId: q1Id, isCorrect: true },
          { questionId: q2Id, isCorrect: true },
          { questionId: q3Id, isCorrect: true },
        ],
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      await expect(service.retryWrong(mockSession._id.toString(), userId)).rejects.toMatchObject({
        errorCode: ErrorCode.CANNOT_RETRY_SESSION,
      });
    });

    it('tạo session mới thành công với roundNumber = cha.roundNumber + 1 và parentSessionId = cha._id', async () => {
      const parentSessionId = new Types.ObjectId();
      const mockParent = {
        _id: parentSessionId,
        userId: new Types.ObjectId(userId),
        mode: ExamTakeMode.PRACTICE,
        status: PracticeSessionStatus.COMPLETED,
        roundNumber: 1,
        examId: new Types.ObjectId(examId),
        answers: [
          // q1 đúng, q2 sai, q3 chưa làm
          { questionId: q1Id, selectedKey: 'B', isCorrect: true },
          { questionId: q2Id, selectedKey: 'B', isCorrect: false },
        ],
      };
      mockRepository.findById.mockResolvedValue(mockParent as any);

      const mockExam = buildMockExam();
      mockExamModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExam) });

      const newSessionCreated = {
        _id: new Types.ObjectId(),
        examId: mockParent.examId,
        userId: mockParent.userId,
        mode: ExamTakeMode.PRACTICE,
        roundNumber: 2,
        parentSessionId: parentSessionId,
        score: { correct: 0, total: 2 },
        answers: [],
        status: PracticeSessionStatus.IN_PROGRESS,
      };
      mockRepository.create.mockResolvedValue(newSessionCreated as any);

      const result = await service.retryWrong(parentSessionId.toString(), userId);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roundNumber: 2,
          parentSessionId: parentSessionId,
          mode: ExamTakeMode.PRACTICE,
          status: PracticeSessionStatus.IN_PROGRESS,
          score: { correct: 0, total: 2 }, // gồm câu 2 (sai) và câu 3 (chưa làm)
          answers: [],
        }),
      );
      expect(result).toEqual(newSessionCreated);
    });
  });

  describe('getSessionDetail', () => {
    it('ném lỗi FORBIDDEN nếu user không phải chủ sở hữu', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      await expect(
        service.getSessionDetail(mockSession._id.toString(), userId),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });
    });

    it('trả về chi tiết session khi đúng chủ sở hữu', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        score: { correct: 2, total: 3 },
      };
      mockRepository.findById.mockResolvedValue(mockSession as any);

      const result = await service.getSessionDetail(mockSession._id.toString(), userId);
      expect(result).toEqual(mockSession);
    });
  });

  describe('getUserSessions', () => {
    it('lấy danh sách phân trang sessions của user', async () => {
      const items = [{ id: 's-1' }, { id: 's-2' }];
      mockRepository.findWithPagination.mockResolvedValue({
        items: items as any,
        total: 2,
      });

      const result = await service.getUserSessions(userId, {
        page: 1,
        limit: 10,
        skip: 0,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(result.data).toEqual(items);
      expect(result.meta.totalItems).toBe(2);
    });
  });
});
