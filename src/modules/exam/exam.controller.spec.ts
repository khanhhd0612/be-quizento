import { Test, TestingModule } from '@nestjs/testing';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { QueryExamDto } from './dto/query-exam.dto';
import { GetExamQuestionsQueryDto } from './dto/get-exam-questions.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateExamPrivacyDto } from './dto/update-exam-privacy.dto';
import { ExamPrivacy } from './enums/exam.enum';

describe('ExamController', () => {
  let controller: ExamController;
  let service: jest.Mocked<ExamService>;

  const mockExamService = {
    findAllExams: jest.fn(),
    getExamDetail: jest.fn(),
    getExamQuestions: jest.fn(),
    createExam: jest.fn(),
    findMyExams: jest.fn(),
    updateExam: jest.fn(),
    updatePrivacy: jest.fn(),
    deleteExam: jest.fn(),
    uploadQuestionMedia: jest.fn(),
    deleteQuestionMedia: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamController],
      providers: [
        {
          provide: ExamService,
          useValue: mockExamService,
        },
      ],
    }).compile();

    controller = module.get<ExamController>(ExamController);
    service = module.get(ExamService);
  });

  it('phải khởi tạo ExamController thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('createExam', () => {
    it('gọi service.createExam với dto và user sub, trả về message kèm data', async () => {
      const mockCreated = {
        id: 'exam-1',
        title: 'Kinh tế vi mô - Chương 3',
        privacy: ExamPrivacy.PUBLIC,
      };

      mockExamService.createExam.mockResolvedValue(mockCreated);

      const dto: CreateExamDto = {
        title: 'Kinh tế vi mô - Chương 3',
        tags: ['kinhtevimo', 'daihoc'],
        privacy: ExamPrivacy.PUBLIC,
        practiceModeEnabled: true,
        examModeEnabled: true,
        questions: [],
      };

      const result = await controller.createExam(dto, { sub: 'user-123' });

      expect(service.createExam).toHaveBeenCalledWith(dto, 'user-123');
      expect(result).toEqual({
        message: 'Tạo đề thi thành công',
        data: mockCreated,
      });
    });
  });

  describe('getExams', () => {
    it('gọi service.findAllExams với đúng query và user sub', async () => {
      const mockResult = {
        data: [],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
        message: 'Lấy danh sách đề thi thành công',
      };

      mockExamService.findAllExams.mockResolvedValue(mockResult);

      const query = new QueryExamDto();
      const user = { sub: 'user-123' };

      const result = await controller.getExams(query, user);

      expect(service.findAllExams).toHaveBeenCalledWith(query, 'user-123');
      expect(result).toEqual(mockResult);
    });
  });

  describe('getMyExams', () => {
    it('gọi service.findMyExams với đúng query và user sub', async () => {
      const mockResult = {
        data: [],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
        message: 'Lấy danh sách đề thi của tôi thành công',
      };

      mockExamService.findMyExams.mockResolvedValue(mockResult);

      const query = new QueryExamDto();
      const user = { sub: 'user-123' };

      const result = await controller.getMyExams(query, user);

      expect(service.findMyExams).toHaveBeenCalledWith(query, 'user-123');
      expect(result).toEqual(mockResult);
    });
  });

  describe('getExamDetail', () => {
    it('gọi service.getExamDetail với examId và user sub, trả về định dạng bọc message và data', async () => {
      const mockExam = {
        id: 'exam-123',
        title: 'Đề thi THPT Quốc Gia',
      };

      mockExamService.getExamDetail.mockResolvedValue(mockExam);

      const result = await controller.getExamDetail('exam-123', { sub: 'user-123' });

      expect(service.getExamDetail).toHaveBeenCalledWith('exam-123', 'user-123');
      expect(result).toEqual({
        message: 'Lấy chi tiết đề thi thành công',
        data: mockExam,
      });
    });
  });

  describe('getExamQuestions', () => {
    it('gọi service.getExamQuestions với examId, query và user sub, trả về định dạng bọc message và data', async () => {
      const mockQuestions = [
        {
          id: 'q-1',
          order: 1,
          content: 'Câu hỏi 1',
        },
      ];

      mockExamService.getExamQuestions.mockResolvedValue(mockQuestions);

      const query = new GetExamQuestionsQueryDto();
      const result = await controller.getExamQuestions('exam-123', query, { sub: 'user-123' });

      expect(service.getExamQuestions).toHaveBeenCalledWith('exam-123', query, 'user-123');
      expect(result).toEqual({
        message: 'Lấy danh sách câu hỏi thành công',
        data: mockQuestions,
      });
    });
  });

  describe('updateExam', () => {
    it('gọi service.updateExam với examId, dto và user sub, trả về message kèm data', async () => {
      const mockUpdated = {
        id: 'exam-123',
        title: 'Tiêu đề cập nhật',
      };

      mockExamService.updateExam.mockResolvedValue(mockUpdated);

      const dto: UpdateExamDto = { title: 'Tiêu đề cập nhật' };
      const result = await controller.updateExam('exam-123', dto, { sub: 'user-123' });

      expect(service.updateExam).toHaveBeenCalledWith('exam-123', dto, 'user-123');
      expect(result).toEqual({
        message: 'Cập nhật đề thi thành công',
        data: mockUpdated,
      });
    });
  });

  describe('updateExamPrivacy', () => {
    it('gọi service.updatePrivacy với examId, privacy và user sub, trả về message kèm data', async () => {
      const mockUpdated = {
        id: 'exam-123',
        privacy: ExamPrivacy.PRIVATE,
      };

      mockExamService.updatePrivacy.mockResolvedValue(mockUpdated);

      const dto: UpdateExamPrivacyDto = { privacy: ExamPrivacy.PRIVATE };
      const result = await controller.updateExamPrivacy('exam-123', dto, { sub: 'user-123' });

      expect(service.updatePrivacy).toHaveBeenCalledWith(
        'exam-123',
        ExamPrivacy.PRIVATE,
        'user-123',
      );
      expect(result).toEqual({
        message: 'Cập nhật quyền riêng tư thành công',
        data: mockUpdated,
      });
    });
  });

  describe('deleteExam', () => {
    it('gọi service.deleteExam với examId và user, trả về message thành công', async () => {
      mockExamService.deleteExam.mockResolvedValue(undefined);

      const user = { sub: 'user-123', role: 'user' };
      const result = await controller.deleteExam('exam-123', user);

      expect(service.deleteExam).toHaveBeenCalledWith('exam-123', user);
      expect(result).toEqual({
        message: 'Xóa đề thi thành công',
      });
    });
  });

  describe('uploadQuestionMedia', () => {
    it('gọi service.uploadQuestionMedia với đúng tham số, trả về message kèm data', async () => {
      const mockResult = {
        url: 'https://cdn.example.com/audio.mp3',
        sizeBytes: 2048510,
        type: 'audio',
      };

      mockExamService.uploadQuestionMedia.mockResolvedValue(mockResult as any);

      const mockFile = {
        originalname: 'audio.mp3',
        mimetype: 'audio/mpeg',
        buffer: Buffer.from('test'),
        size: 2048510,
      } as Express.Multer.File;

      const dto = { type: 'audio' } as any;
      const user = { sub: 'user-123' };

      const result = await controller.uploadQuestionMedia('exam-123', 'q-1', mockFile, dto, user);

      expect(service.uploadQuestionMedia).toHaveBeenCalledWith(
        'exam-123',
        'q-1',
        mockFile,
        dto,
        'user-123',
      );
      expect(result).toEqual({
        message: 'Upload media câu hỏi thành công',
        data: mockResult,
      });
    });
  });

  describe('deleteQuestionMedia', () => {
    it('gọi service.deleteQuestionMedia với đúng examId, questionId và user sub, trả về message thành công', async () => {
      mockExamService.deleteQuestionMedia.mockResolvedValue(undefined);

      const user = { sub: 'user-123' };
      const result = await controller.deleteQuestionMedia('exam-123', 'q-1', user);

      expect(service.deleteQuestionMedia).toHaveBeenCalledWith('exam-123', 'q-1', 'user-123');
      expect(result).toEqual({
        message: 'Xóa media khỏi câu hỏi thành công',
      });
    });
  });
});
