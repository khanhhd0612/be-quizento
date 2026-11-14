import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: UploadService;

  const mockUploadService = {
    uploadSingleImage: jest.fn(),
    uploadSingleAudio: jest.fn(),
    uploadMultipleImages: jest.fn(),
    deleteImage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    uploadService = module.get<UploadService>(UploadService);
  });

  it('phải khởi tạo controller thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadSingleImage', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('bytes'),
      size: 5,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('throw FILE_NOT_FOUND nếu không có file', async () => {
      await expect(controller.uploadSingleImage(null as any, 'avatars')).rejects.toThrow(
        new BusinessException(ErrorCode.FILE_NOT_FOUND),
      );
    });

    it('gọi uploadService và trả về kết quả thành công', async () => {
      const mockResult = {
        url: 'https://pub-test.r2.dev/images/test.png',
        key: 'images/test.png',
        filename: 'test.png',
        mimetype: 'image/png',
        size: 5,
        bucket: 'test-bucket',
      };

      mockUploadService.uploadSingleImage.mockResolvedValueOnce(mockResult);

      const response = await controller.uploadSingleImage(mockFile, 'avatars');

      expect(mockUploadService.uploadSingleImage).toHaveBeenCalledWith(mockFile, {
        folder: 'avatars',
      });
      expect(response.message).toBe('Tải ảnh lên Cloudflare R2 thành công');
      expect(response.data).toEqual(mockResult);
    });
  });

  describe('uploadSingleAudio', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.mp3',
      encoding: '7bit',
      mimetype: 'audio/mpeg',
      buffer: Buffer.from('bytes'),
      size: 10,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('throw FILE_NOT_FOUND nếu không có file', async () => {
      await expect(controller.uploadSingleAudio(null as any, 'exams')).rejects.toThrow(
        new BusinessException(ErrorCode.FILE_NOT_FOUND),
      );
    });

    it('gọi uploadService và trả về kết quả thành công', async () => {
      const mockResult = {
        url: 'https://pub-test.r2.dev/audio/test.mp3',
        key: 'audio/test.mp3',
        filename: 'test.mp3',
        mimetype: 'audio/mpeg',
        size: 10,
        bucket: 'test-bucket',
      };

      mockUploadService.uploadSingleAudio.mockResolvedValueOnce(mockResult);

      const response = await controller.uploadSingleAudio(mockFile, 'exams');

      expect(mockUploadService.uploadSingleAudio).toHaveBeenCalledWith(mockFile, {
        folder: 'exams',
      });
      expect(response.message).toBe('Tải file audio lên Cloudflare R2 thành công');
      expect(response.data).toEqual(mockResult);
    });
  });

  describe('uploadMultipleImages', () => {
    const mockFiles: Express.Multer.File[] = [
      {
        fieldname: 'files',
        originalname: 'img1.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('bytes'),
        size: 5,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      },
    ];

    it('throw FILE_NOT_FOUND nếu danh sách file rỗng', async () => {
      await expect(controller.uploadMultipleImages([], 'gallery')).rejects.toThrow(
        new BusinessException(ErrorCode.FILE_NOT_FOUND),
      );
    });

    it('gọi uploadService và trả về danh sách ảnh đã upload', async () => {
      const mockResults = [
        {
          url: 'https://pub-test.r2.dev/gallery/img1.png',
          key: 'gallery/img1.png',
          filename: 'img1.png',
          mimetype: 'image/png',
          size: 5,
          bucket: 'test-bucket',
        },
      ];

      mockUploadService.uploadMultipleImages.mockResolvedValueOnce(mockResults);

      const response = await controller.uploadMultipleImages(mockFiles, 'gallery');

      expect(mockUploadService.uploadMultipleImages).toHaveBeenCalledWith(mockFiles, {
        folder: 'gallery',
      });
      expect(response.message).toBe('Tải danh sách ảnh lên Cloudflare R2 thành công');
      expect(response.data).toEqual(mockResults);
    });
  });

  describe('deleteImage', () => {
    it('gọi deleteImage thành công', async () => {
      mockUploadService.deleteImage.mockResolvedValueOnce(undefined);

      const response = await controller.deleteImage({ key: 'images/test.png' });

      expect(mockUploadService.deleteImage).toHaveBeenCalledWith('images/test.png');
      expect(response.message).toBe('Xoá file trên Cloudflare R2 thành công');
    });
  });
});
