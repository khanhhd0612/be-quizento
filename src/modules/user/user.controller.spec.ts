import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-code.constant';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    removeAvatar: jest.fn(),
    changeUserPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  it('phải khởi tạo controller thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('trả về profile đầy đủ gồm avatar và authProvider', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Nguyễn Văn A',
        role: 'user',
        avatar: 'https://pub-test.r2.dev/avatars/avatar.png',
        authProvider: 'local',
        isActive: true,
        createdAt: new Date(),
      };

      mockUserService.getProfile.mockResolvedValueOnce(mockUser);

      const result = await controller.getProfile({ sub: 'user-123' });

      expect(mockUserService.getProfile).toHaveBeenCalledWith('user-123');
      expect(result.data.avatar).toBe('https://pub-test.r2.dev/avatars/avatar.png');
      expect(result.data.authProvider).toBe('local');
    });
  });

  describe('updateProfile', () => {
    it('cập nhật thành công và trả về avatar mới nếu có', async () => {
      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Nguyễn Văn B',
        role: 'user',
        avatar: 'https://pub-test.r2.dev/avatars/new-avatar.png',
        authProvider: 'local',
      };

      mockUserService.updateProfile.mockResolvedValueOnce(updatedUser);

      const result = await controller.updateProfile(
        { sub: 'user-123' },
        { fullName: 'Nguyễn Văn B', avatar: 'https://pub-test.r2.dev/avatars/new-avatar.png' },
      );

      expect(mockUserService.updateProfile).toHaveBeenCalledWith('user-123', {
        fullName: 'Nguyễn Văn B',
        avatar: 'https://pub-test.r2.dev/avatars/new-avatar.png',
      });
      expect(result.data.avatar).toBe('https://pub-test.r2.dev/avatars/new-avatar.png');
    });
  });

  describe('uploadAvatar', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('bytes'),
      size: 100,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('throw FILE_NOT_FOUND nếu không gửi file', async () => {
      await expect(controller.uploadAvatar({ sub: 'user-123' }, null as any)).rejects.toThrow(
        new BusinessException(ErrorCode.FILE_NOT_FOUND),
      );
    });

    it('gọi uploadAvatar của service và trả về URL mới', async () => {
      mockUserService.uploadAvatar.mockResolvedValueOnce(
        'https://pub-test.r2.dev/avatars/uploaded.png',
      );

      const result = await controller.uploadAvatar({ sub: 'user-123' }, mockFile);

      expect(mockUserService.uploadAvatar).toHaveBeenCalledWith('user-123', mockFile);
      expect(result.data.avatar).toBe('https://pub-test.r2.dev/avatars/uploaded.png');
    });
  });

  describe('deleteAvatar', () => {
    it('xoá avatar thành công', async () => {
      mockUserService.removeAvatar.mockResolvedValueOnce(undefined);

      const result = await controller.deleteAvatar({ sub: 'user-123' });

      expect(mockUserService.removeAvatar).toHaveBeenCalledWith('user-123');
      expect(result.data.avatar).toBeNull();
    });
  });
});
