import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { R2Service } from './r2.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

describe('R2Service', () => {
  let service: R2Service;
  let configService: ConfigService;

  const mockConfig: Record<string, string> = {
    'r2.accountId': 'test-account-id',
    'r2.accessKeyId': 'test-access-key',
    'r2.secretAccessKey': 'test-secret-key',
    'r2.bucketName': 'test-bucket',
    'r2.publicUrl': 'https://pub-test.r2.dev',
    'r2.endpoint': 'https://test-account-id.r2.cloudflarestorage.com',
  };

  const createService = async (customConfig: Record<string, string> = mockConfig) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => customConfig[key]),
          },
        },
      ],
    }).compile();

    return module.get<R2Service>(R2Service);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await createService();
  });

  it('phải khởi tạo service thành công', () => {
    expect(service).toBeDefined();
    expect(service.isConfigured()).toBe(true);
  });

  describe('isConfigured', () => {
    it('trả về false nếu thiếu biến môi trường R2', async () => {
      const unconfiguredService = await createService({
        'r2.accountId': '',
        'r2.accessKeyId': '',
        'r2.secretAccessKey': '',
        'r2.bucketName': '',
        'r2.publicUrl': '',
        'r2.endpoint': '',
      });

      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('uploadImage', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image-bytes'),
      size: 16,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('throw FILE_NOT_FOUND nếu không truyền file hoặc buffer rỗng', async () => {
      await expect(service.uploadImage(null as any)).rejects.toThrow(
        new BusinessException(ErrorCode.FILE_NOT_FOUND),
      );

      await expect(service.uploadImage({ ...mockFile, buffer: null as any })).rejects.toThrow(
        new BusinessException(ErrorCode.FILE_NOT_FOUND),
      );
    });

    it('throw R2_NOT_CONFIGURED nếu service chưa được cấu hình R2', async () => {
      const unconfiguredService = await createService({});
      await expect(unconfiguredService.uploadImage(mockFile)).rejects.toThrow(
        new BusinessException(ErrorCode.R2_NOT_CONFIGURED),
      );
    });

    it('upload thành công và trả về đường dẫn public URL', async () => {
      const sendSpy = jest
        .spyOn((service as any).s3Client, 'send')
        .mockResolvedValueOnce({} as any);

      const result = await service.uploadImage(mockFile, { folder: 'avatars' });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const commandArg = sendSpy.mock.calls[0][0] as PutObjectCommand;
      expect(commandArg.input.Bucket).toBe('test-bucket');
      expect(commandArg.input.ContentType).toBe('image/png');
      expect(commandArg.input.Key).toMatch(/^avatars\/\d{4}-\d{2}-\d{2}\/.*-avatar\.png$/);

      expect(result).toBeDefined();
      expect(result.filename).toBe('avatar.png');
      expect(result.mimetype).toBe('image/png');
      expect(result.size).toBe(16);
      expect(result.bucket).toBe('test-bucket');
      expect(result.url).toContain('https://pub-test.r2.dev/avatars/');
    });

    it('nếu không cấu hình publicUrl, fallback sang endpoint/bucket/key', async () => {
      const noPublicUrlService = await createService({
        ...mockConfig,
        'r2.publicUrl': '',
      });

      jest.spyOn((noPublicUrlService as any).s3Client, 'send').mockResolvedValueOnce({} as any);

      const result = await noPublicUrlService.uploadImage(mockFile);

      expect(result.url).toContain('https://test-account-id.r2.cloudflarestorage.com/test-bucket/');
    });

    it('throw R2_UPLOAD_FAILED nếu S3Client ném lỗi khi upload', async () => {
      jest
        .spyOn((service as any).s3Client, 'send')
        .mockRejectedValueOnce(new Error('S3 Connection Timeout'));

      await expect(service.uploadImage(mockFile)).rejects.toThrow(BusinessException);
    });
  });

  describe('uploadImages', () => {
    const mockFiles: Express.Multer.File[] = [
      {
        fieldname: 'files',
        originalname: 'img1.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-1'),
        size: 6,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      },
      {
        fieldname: 'files',
        originalname: 'img2.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-2'),
        size: 6,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      },
    ];

    it('throw FILE_NOT_FOUND nếu mảng file rỗng', async () => {
      await expect(service.uploadImages([])).rejects.toThrow(
        new BusinessException(ErrorCode.FILE_NOT_FOUND),
      );
    });

    it('upload thành công toàn bộ danh sách file', async () => {
      jest.spyOn((service as any).s3Client, 'send').mockResolvedValue({} as any);

      const results = await service.uploadImages(mockFiles, { folder: 'gallery' });

      expect(results).toHaveLength(2);
      expect(results[0].filename).toBe('img1.png');
      expect(results[1].filename).toBe('img2.jpg');
    });
  });

  describe('deleteFile', () => {
    it('throw BAD_REQUEST nếu key rỗng', async () => {
      await expect(service.deleteFile('')).rejects.toThrow(BusinessException);
    });

    it('throw R2_NOT_CONFIGURED nếu service chưa cấu hình', async () => {
      const unconfiguredService = await createService({});
      await expect(unconfiguredService.deleteFile('some/key.png')).rejects.toThrow(
        new BusinessException(ErrorCode.R2_NOT_CONFIGURED),
      );
    });

    it('xoá thành công file theo key', async () => {
      const sendSpy = jest
        .spyOn((service as any).s3Client, 'send')
        .mockResolvedValueOnce({} as any);

      await service.deleteFile('images/avatar.png');

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const commandArg = sendSpy.mock.calls[0][0] as DeleteObjectCommand;
      expect(commandArg.input.Bucket).toBe('test-bucket');
      expect(commandArg.input.Key).toBe('images/avatar.png');
    });

    it('throw R2_DELETE_FAILED nếu S3Client ném lỗi', async () => {
      jest
        .spyOn((service as any).s3Client, 'send')
        .mockRejectedValueOnce(new Error('Access Denied'));

      await expect(service.deleteFile('images/avatar.png')).rejects.toThrow(BusinessException);
    });
  });

  describe('extractKeyFromUrl', () => {
    it('trả về key khi URL bắt đầu bằng publicUrl', () => {
      const key = service.extractKeyFromUrl(
        'https://pub-test.r2.dev/avatars/2026-10-09/uuid-avatar.png',
      );
      expect(key).toBe('avatars/2026-10-09/uuid-avatar.png');
    });

    it('trả về key khi URL bắt đầu bằng endpoint/bucket', () => {
      const key = service.extractKeyFromUrl(
        'https://test-account-id.r2.cloudflarestorage.com/test-bucket/avatars/avatar.png',
      );
      expect(key).toBe('avatars/avatar.png');
    });

    it('trả về null nếu là link avatar mặc định hoặc bên thứ ba (Google)', () => {
      expect(service.extractKeyFromUrl('https://lh3.googleusercontent.com/a/photo.jpg')).toBeNull();
      expect(service.extractKeyFromUrl('/avatars/shadcn.jpg')).toBeNull();
      expect(service.extractKeyFromUrl(null)).toBeNull();
    });
  });

  describe('deleteFileByUrl', () => {
    it('gọi deleteFile khi URL trỏ tới file R2 hợp lệ', async () => {
      const deleteSpy = jest.spyOn(service, 'deleteFile').mockResolvedValueOnce(undefined);

      const result = await service.deleteFileByUrl(
        'https://pub-test.r2.dev/avatars/old-avatar.png',
      );

      expect(deleteSpy).toHaveBeenCalledWith('avatars/old-avatar.png');
      expect(result).toBe(true);
    });

    it('trả về false và không gọi deleteFile nếu không phải file R2', async () => {
      const deleteSpy = jest.spyOn(service, 'deleteFile');

      const result = await service.deleteFileByUrl('https://lh3.googleusercontent.com/avatar.jpg');

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
