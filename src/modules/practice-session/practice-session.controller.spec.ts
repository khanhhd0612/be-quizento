import { Test, TestingModule } from '@nestjs/testing';
import { PracticeSessionController } from './practice-session.controller';
import { PracticeSessionService } from './practice-session.service';
import { ExamTakeMode } from '@modules/exam/enums/exam.enum';
import { CreatePracticeSessionDto } from './dto/create-practice-session.dto';
import { SubmitSessionAnswerDto } from './dto/submit-session-answer.dto';
import { QueryUserSessionsDto } from './dto/query-user-sessions.dto';

describe('PracticeSessionController', () => {
  let controller: PracticeSessionController;
  let service: jest.Mocked<PracticeSessionService>;

  const mockPracticeSessionService = {
    startSession: jest.fn(),
    submitAnswer: jest.fn(),
    submitSession: jest.fn(),
    getSessionDetail: jest.fn(),
    retryWrong: jest.fn(),
    getUserSessions: jest.fn(),
  };

  const userId = 'user-123';
  const examId = 'exam-123';
  const sessionId = 'session-123';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PracticeSessionController],
      providers: [
        {
          provide: PracticeSessionService,
          useValue: mockPracticeSessionService,
        },
      ],
    }).compile();

    controller = module.get<PracticeSessionController>(PracticeSessionController);
    service = module.get(PracticeSessionService);
  });

  it('phải khởi tạo PracticeSessionController thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('startSession', () => {
    it('gọi service.startSession và trả về message kèm data', async () => {
      const mockResult = { id: sessionId, mode: ExamTakeMode.PRACTICE };
      mockPracticeSessionService.startSession.mockResolvedValue(mockResult as any);

      const dto: CreatePracticeSessionDto = { mode: ExamTakeMode.PRACTICE };
      const response = await controller.startSession(examId, dto, { sub: userId });

      expect(service.startSession).toHaveBeenCalledWith(examId, dto, userId);
      expect(response).toEqual({
        message: 'Bắt đầu lượt làm bài mới thành công',
        data: mockResult,
      });
    });
  });

  describe('submitAnswer', () => {
    it('gọi service.submitAnswer và trả về kết quả', async () => {
      const mockResult = { isCorrect: true, explanation: 'Chi tiết' };
      mockPracticeSessionService.submitAnswer.mockResolvedValue(mockResult);

      const dto: SubmitSessionAnswerDto = {
        questionId: 'q-1',
        selectedKey: 'B',
      };
      const response = await controller.submitAnswer(sessionId, dto, {
        sub: userId,
      });

      expect(service.submitAnswer).toHaveBeenCalledWith(sessionId, dto, userId);
      expect(response.data).toEqual(mockResult);
      expect(response.isCorrect).toBe(true);
    });
  });

  describe('submitSession', () => {
    it('gọi service.submitSession và trả về session hoàn thành', async () => {
      const mockResult = { id: sessionId, status: 'completed' };
      mockPracticeSessionService.submitSession.mockResolvedValue(mockResult as any);

      const response = await controller.submitSession(
        sessionId,
        {
          sub: userId,
        },
        undefined,
      );

      expect(service.submitSession).toHaveBeenCalledWith(sessionId, userId, undefined);
      expect(response).toEqual({
        message: 'Nộp bài thi thành công',
        data: mockResult,
      });
    });
  });

  describe('getSessionDetail', () => {
    it('gọi service.getSessionDetail và trả về thông tin session', async () => {
      const mockResult = { id: sessionId, roundNumber: 1 };
      mockPracticeSessionService.getSessionDetail.mockResolvedValue(mockResult as any);

      const response = await controller.getSessionDetail(sessionId, {
        sub: userId,
      });

      expect(service.getSessionDetail).toHaveBeenCalledWith(sessionId, userId);
      expect(response).toEqual({
        message: 'Lấy chi tiết lượt làm bài thành công',
        data: mockResult,
      });
    });
  });

  describe('retryWrong', () => {
    it('gọi service.retryWrong và trả về session mới', async () => {
      const mockResult = { id: 'new-session', roundNumber: 2 };
      mockPracticeSessionService.retryWrong.mockResolvedValue(mockResult as any);

      const response = await controller.retryWrong(sessionId, { sub: userId });

      expect(service.retryWrong).toHaveBeenCalledWith(sessionId, userId);
      expect(response).toEqual({
        message: 'Tạo lượt làm lại câu sai thành công',
        data: mockResult,
      });
    });
  });

  describe('getUserSessions', () => {
    it('gọi service.getUserSessions với query và user id', async () => {
      const mockResult = { data: [], meta: {} };
      mockPracticeSessionService.getUserSessions.mockResolvedValue(mockResult as any);

      const query: QueryUserSessionsDto = {
        page: 1,
        limit: 10,
        skip: 0,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
      const response = await controller.getUserSessions({ sub: userId }, query);

      expect(service.getUserSessions).toHaveBeenCalledWith(userId, query);
      expect(response).toEqual(mockResult);
    });
  });
});
