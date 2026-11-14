import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { UploadService } from '@modules/upload/upload.service';
import { User } from './entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let userRepository: UserRepository;
  let uploadService: UploadService;

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Nguyễn Văn A',
    avatar: 'https://pub-test.r2.dev/avatars/old-avatar.png',
  };

  const mockUserRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByGoogleId: jest.fn(),
    update: jest.fn(),
  };

  const mockUploadService = {
    uploadSingleImage: jest.fn(),
    deleteFileByUrl: jest.fn(),
  };

  const mockUserModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<UserRepository>(UserRepository);
    uploadService = module.get<UploadService>(UploadService);
  });

  describe('uploadAvatar', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'new-avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('data'),
      size: 10,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('upload ảnh mới lên R2, cập nhật DB và xoá ảnh cũ trên R2', async () => {
      mockUserRepository.findById.mockResolvedValueOnce({ ...mockUser });
      mockUploadService.uploadSingleImage.mockResolvedValueOnce({
        url: 'https://pub-test.r2.dev/avatars/new-avatar.png',
        key: 'avatars/new-avatar.png',
      });
      jest.spyOn(service, 'update').mockResolvedValueOnce({
        ...mockUser,
        avatar: 'https://pub-test.r2.dev/avatars/new-avatar.png',
      } as any);

      const result = await service.uploadAvatar('user-123', mockFile);

      expect(mockUploadService.uploadSingleImage).toHaveBeenCalledWith(mockFile, {
        folder: 'avatars',
      });
      expect(service.update).toHaveBeenCalledWith('user-123', {
        avatar: 'https://pub-test.r2.dev/avatars/new-avatar.png',
      });
      expect(mockUploadService.deleteFileByUrl).toHaveBeenCalledWith(
        'https://pub-test.r2.dev/avatars/old-avatar.png',
      );
      expect(result).toBe('https://pub-test.r2.dev/avatars/new-avatar.png');
    });

    it('không gọi xoá ảnh cũ nếu user chưa từng có avatar trước đó', async () => {
      mockUserRepository.findById.mockResolvedValueOnce({
        ...mockUser,
        avatar: undefined,
      });
      mockUploadService.uploadSingleImage.mockResolvedValueOnce({
        url: 'https://pub-test.r2.dev/avatars/new-avatar.png',
      });
      jest.spyOn(service, 'update').mockResolvedValueOnce({} as any);

      await service.uploadAvatar('user-123', mockFile);

      expect(mockUploadService.deleteFileByUrl).not.toHaveBeenCalled();
    });
  });

  describe('removeAvatar', () => {
    it('xoá ảnh trên R2 và đặt avatar thành undefined trong DB', async () => {
      mockUserRepository.findById.mockResolvedValueOnce({ ...mockUser });
      jest.spyOn(service, 'update').mockResolvedValueOnce({
        ...mockUser,
        avatar: undefined,
      } as any);

      await service.removeAvatar('user-123');

      expect(service.update).toHaveBeenCalledWith('user-123', {
        avatar: undefined,
      });
      expect(mockUploadService.deleteFileByUrl).toHaveBeenCalledWith(
        'https://pub-test.r2.dev/avatars/old-avatar.png',
      );
    });
  });

  describe('updateProfile', () => {
    it('xoá avatar cũ nếu dto.avatar khác với avatar hiện tại', async () => {
      mockUserRepository.findById.mockResolvedValueOnce({ ...mockUser });
      jest.spyOn(service, 'update').mockResolvedValueOnce({} as any);

      await service.updateProfile('user-123', {
        fullName: 'Nguyễn Văn A',
        avatar: 'https://pub-test.r2.dev/avatars/another.png',
      });

      expect(mockUploadService.deleteFileByUrl).toHaveBeenCalledWith(
        'https://pub-test.r2.dev/avatars/old-avatar.png',
      );
    });
  });
});
