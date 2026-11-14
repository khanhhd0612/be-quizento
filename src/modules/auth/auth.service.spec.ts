import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '@modules/user/user.service';
import { TokenBlacklistRepository } from './repositories/token-blacklist.repository';
import { SessionRepository } from './repositories/session.repository';
import { ErrorCode } from '@common/constants/error-code.constant';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { MailService } from '@/shared/mail/mail.service';

jest.mock('bcrypt');
jest.mock('@common/utils/device.util', () => ({
  parseDeviceName: jest.fn().mockReturnValue('Chrome trên Windows'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let tokenBlacklistRepository: jest.Mocked<TokenBlacklistRepository>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let passwordResetRepository: jest.Mocked<PasswordResetRepository>;
  let mailService: jest.Mocked<MailService>;

  const mockUser = {
    id: 'user-id-1',
    email: 'user@example.com',
    password: 'hashed-password',
    fullName: 'Nguyễn Văn A',
    role: 'user',
    isActive: true,
    tokenValidAfter: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            findByGoogleId: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findOneOrFail: jest.fn(),
            findById: jest.fn(),
            changePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: TokenBlacklistRepository,
          useValue: {
            create: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: SessionRepository,
          useValue: {
            create: jest.fn(),
            findActiveByUser: jest.fn(),
            findById: jest.fn(),
            revoke: jest.fn(),
            revokeAllExcept: jest.fn(),
          },
        },
        {
          provide: PasswordResetRepository,
          useValue: {
            countRecentByEmail: jest.fn(),
            create: jest.fn(),
            findValidByHash: jest.fn(),
            markUsed: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    tokenBlacklistRepository = module.get(TokenBlacklistRepository);
    sessionRepository = module.get(SessionRepository);
    passwordResetRepository = module.get(PasswordResetRepository);
    mailService = module.get(MailService);

    // Config mặc định dùng chung cho hầu hết test case
    configService.get.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        'jwt.accessSecret': 'access-secret',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': 'refresh-secret',
        'jwt.refreshExpiresIn': '7d',
      };
      return map[key];
    });

    jwtService.sign.mockImplementation((payload: any) => `signed.${payload.jti}.token`);
    jwtService.decode.mockImplementation((token: string) => {
      if (typeof token !== 'string') return null;
      const parts = token.split('.');
      // token giả dạng "signed.<jti>.token"
      return { jti: parts[1], exp: Math.floor(Date.now() / 1000) + 3600 };
    });

    jest.clearAllMocks();
    // clearAllMocks ở trên xoá luôn implementation vừa set, set lại cho chắc
    configService.get.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        'jwt.accessSecret': 'access-secret',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': 'refresh-secret',
        'jwt.refreshExpiresIn': '7d',
      };
      return map[key];
    });
    jwtService.sign.mockImplementation((payload: any) => `signed.${payload.jti}.token`);
    jwtService.decode.mockImplementation((token: string) => {
      if (typeof token !== 'string') return null;
      const parts = token.split('.');
      return { jti: parts[1], exp: Math.floor(Date.now() / 1000) + 3600 };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------
  describe('login', () => {
    const loginDto = { email: 'user@example.com', password: 'plain-password' };

    it('đăng nhập thành công, trả về accessToken + refreshToken và tạo session', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto as any, {
        userAgent: 'Mozilla/5.0 Chrome',
        ip: '127.0.0.1',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(sessionRepository.create).toHaveBeenCalledTimes(1);
      expect(sessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          userAgent: 'Mozilla/5.0 Chrome',
          ip: '127.0.0.1',
        }),
      );
    });

    it('throw AUTH_INVALID_CREDENTIALS nếu không tìm thấy user', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto as any)).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throw AUTH_INVALID_CREDENTIALS nếu sai mật khẩu', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto as any)).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
      });
      expect(sessionRepository.create).not.toHaveBeenCalled();
    });

    it('throw AUTH_ACCOUNT_LOCKED nếu tài khoản bị khoá', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto as any)).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_ACCOUNT_LOCKED,
      });
      expect(sessionRepository.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------
  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'plain-password',
      fullName: 'New User',
    };

    it('đăng ký thành công khi email chưa tồn tại', async () => {
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userService.create.mockResolvedValue({ id: 'new-id' } as any);

      const result = await service.register(registerDto as any);

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          password: 'hashed-password',
          deletedAt: null,
        }),
      );
      expect(result).toEqual({ id: 'new-id' });
    });

    it('không trả về password trong kết quả đăng ký', async () => {
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userService.create.mockResolvedValue({
        id: 'new-id',
        email: registerDto.email,
        password: 'hashed-password',
      } as any);

      const result = await service.register(registerDto as any);

      expect((result as any).password).toBeUndefined();
    });

    it('throw USER_EMAIL_ALREADY_EXISTS nếu email đã tồn tại (check trước)', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.register(registerDto as any)).rejects.toMatchObject({
        errorCode: ErrorCode.USER_EMAIL_ALREADY_EXISTS,
      });
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('throw USER_EMAIL_ALREADY_EXISTS nếu insert bị lỗi 11000 duplicate key (race condition)', async () => {
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const mongoError = { code: 11000, message: 'E11000 duplicate key error' };
      userService.create.mockRejectedValue(mongoError);

      await expect(service.register(registerDto as any)).rejects.toMatchObject({
        errorCode: ErrorCode.USER_EMAIL_ALREADY_EXISTS,
      });
    });

    it('ném lại lỗi gốc nếu không phải 11000', async () => {
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const otherError = new Error('DB down');
      userService.create.mockRejectedValue(otherError);

      await expect(service.register(registerDto as any)).rejects.toThrow('DB down');
    });
  });

  // ---------------------------------------------------------------------
  // refresh
  // ---------------------------------------------------------------------
  describe('refresh', () => {
    it('cấp token mới thành công khi user active', async () => {
      userService.findOneOrFail.mockResolvedValue(mockUser as any);

      const result = await service.refresh(mockUser.id, mockUser.email, mockUser.role);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(sessionRepository.create).toHaveBeenCalledTimes(1);
    });

    it('throw AUTH_ACCOUNT_LOCKED nếu user bị khoá', async () => {
      userService.findOneOrFail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(
        service.refresh(mockUser.id, mockUser.email, mockUser.role),
      ).rejects.toMatchObject({ errorCode: ErrorCode.AUTH_ACCOUNT_LOCKED });
    });
  });

  // ---------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------
  describe('logout', () => {
    it('blacklist đúng jti + exp lấy từ refreshToken được decode', async () => {
      const fakeRefreshToken = 'signed.some-jti-123.token';

      await service.logout(mockUser.id, fakeRefreshToken);

      expect(tokenBlacklistRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jti: 'some-jti-123',
          userId: mockUser.id,
        }),
      );
    });

    it('không làm gì nếu không truyền refreshToken', async () => {
      await service.logout(mockUser.id, undefined);

      expect(tokenBlacklistRepository.create).not.toHaveBeenCalled();
    });

    it('không blacklist nếu decode ra payload thiếu jti/exp', async () => {
      jwtService.decode.mockReturnValueOnce({} as any);

      await service.logout(mockUser.id, 'invalid-token');

      expect(tokenBlacklistRepository.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // changePassword
  // ---------------------------------------------------------------------
  describe('changePassword', () => {
    it('đổi mật khẩu thành công khi mật khẩu cũ đúng', async () => {
      userService.findById.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await service.changePassword(mockUser.id, 'old-pw', 'new-pw');

      expect(userService.changePassword).toHaveBeenCalledWith(mockUser.id, 'new-hashed-password');
    });

    it('throw USER_NOT_FOUND nếu không tìm thấy user', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.changePassword(mockUser.id, 'old-pw', 'new-pw')).rejects.toMatchObject({
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
      expect(userService.changePassword).not.toHaveBeenCalled();
    });

    it('throw INVALID_OLD_PASSWORD nếu mật khẩu cũ sai', async () => {
      userService.findById.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, 'wrong-old-pw', 'new-pw'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_OLD_PASSWORD });
      expect(userService.changePassword).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // getSessions
  // ---------------------------------------------------------------------
  describe('getSessions', () => {
    it('trả về danh sách session đã format, chỉ gồm các field cần thiết', async () => {
      const fakeSessions = [
        {
          id: 'session-1',
          userId: mockUser.id,
          jti: 'jti-1',
          userAgent: 'Chrome',
          ip: '1.1.1.1',
          deviceName: 'Chrome trên Windows',
          createdAt: new Date('2026-01-01'),
          lastUsedAt: new Date('2026-01-02'),
          expiresAt: new Date('2026-01-10'),
          revokedAt: null,
        },
      ];
      sessionRepository.findActiveByUser.mockResolvedValue(fakeSessions as any);

      const result = await service.getSessions(mockUser.id);

      expect(result).toEqual([
        {
          id: 'session-1',
          deviceName: 'Chrome trên Windows',
          ip: '1.1.1.1',
          isCurrent: false,
          createdAt: fakeSessions[0].createdAt,
          lastUsedAt: fakeSessions[0].lastUsedAt,
        },
      ]);
    });
  });

  // ---------------------------------------------------------------------
  // revokeSession
  // ---------------------------------------------------------------------
  describe('revokeSession', () => {
    const fakeSession = {
      id: 'session-1',
      userId: mockUser.id,
      jti: 'jti-1',
      expiresAt: new Date('2026-01-10'),
    };

    it('revoke session + blacklist đúng jti khi session thuộc về user', async () => {
      sessionRepository.findById.mockResolvedValue(fakeSession as any);

      await service.revokeSession(mockUser.id, fakeSession.id);

      expect(sessionRepository.revoke).toHaveBeenCalledWith(fakeSession.id);
      expect(tokenBlacklistRepository.create).toHaveBeenCalledWith({
        jti: fakeSession.jti,
        userId: mockUser.id,
        expiresAt: fakeSession.expiresAt,
      });
    });

    it('throw SESSION_NOT_FOUND nếu session không tồn tại', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(service.revokeSession(mockUser.id, 'not-exist')).rejects.toMatchObject({
        errorCode: ErrorCode.SESSION_NOT_FOUND,
      });
      expect(sessionRepository.revoke).not.toHaveBeenCalled();
    });

    it('throw SESSION_NOT_FOUND nếu session thuộc user khác (chống IDOR)', async () => {
      sessionRepository.findById.mockResolvedValue({
        ...fakeSession,
        userId: 'other-user-id',
      } as any);

      await expect(service.revokeSession(mockUser.id, fakeSession.id)).rejects.toMatchObject({
        errorCode: ErrorCode.SESSION_NOT_FOUND,
      });
      expect(sessionRepository.revoke).not.toHaveBeenCalled();
      expect(tokenBlacklistRepository.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // revokeOtherSessions
  // ---------------------------------------------------------------------
  describe('revokeOtherSessions', () => {
    // Mock decode tách chuỗi theo dấu "." -> phải dùng đúng định dạng
    // "signed.<jti>.token" để decode ra đúng currentJti mong muốn.
    const currentRefreshToken = 'signed.current-jti.token';

    it('blacklist tất cả session khác, giữ lại session hiện tại', async () => {
      const sessions = [
        { id: 's1', jti: 'current-jti', expiresAt: new Date('2026-02-01') },
        { id: 's2', jti: 'other-jti-1', expiresAt: new Date('2026-02-02') },
        { id: 's3', jti: 'other-jti-2', expiresAt: new Date('2026-02-03') },
      ];
      sessionRepository.findActiveByUser.mockResolvedValue(sessions as any);

      await service.revokeOtherSessions(mockUser.id, currentRefreshToken);

      expect(jwtService.decode).toHaveBeenCalledWith(currentRefreshToken);
      expect(tokenBlacklistRepository.create).toHaveBeenCalledTimes(2);
      expect(tokenBlacklistRepository.create).toHaveBeenCalledWith({
        jti: 'other-jti-1',
        userId: mockUser.id,
        expiresAt: sessions[1].expiresAt,
      });
      expect(tokenBlacklistRepository.create).toHaveBeenCalledWith({
        jti: 'other-jti-2',
        userId: mockUser.id,
        expiresAt: sessions[2].expiresAt,
      });
      expect(sessionRepository.revokeAllExcept).toHaveBeenCalledWith(mockUser.id, 'current-jti');
    });

    it('không blacklist gì nếu chỉ có 1 session (chính là session hiện tại)', async () => {
      sessionRepository.findActiveByUser.mockResolvedValue([
        { id: 's1', jti: 'current-jti', expiresAt: new Date() },
      ] as any);

      await service.revokeOtherSessions(mockUser.id, currentRefreshToken);

      expect(tokenBlacklistRepository.create).not.toHaveBeenCalled();
      expect(sessionRepository.revokeAllExcept).toHaveBeenCalledWith(mockUser.id, 'current-jti');
    });

    it('throw AUTH_REFRESH_TOKEN_REQUIRED nếu không truyền refreshToken', async () => {
      await expect(service.revokeOtherSessions(mockUser.id, undefined)).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED,
      });

      expect(sessionRepository.findActiveByUser).not.toHaveBeenCalled();
      expect(tokenBlacklistRepository.create).not.toHaveBeenCalled();
      expect(sessionRepository.revokeAllExcept).not.toHaveBeenCalled();
    });
  });
  // ---------------------------------------------------------------------
  // forgotPassword
  // ---------------------------------------------------------------------
  describe('forgotPassword', () => {
    const email = 'user@example.com';

    beforeEach(() => {
      passwordResetRepository.countRecentByEmail.mockResolvedValue(0);
    });

    it('gửi email reset password thành công khi user tồn tại', async () => {
      userService.findByEmail.mockResolvedValue(mockUser as any);

      passwordResetRepository.create.mockResolvedValue({
        id: 'reset-id-1',
      } as any);

      mailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword(email);

      expect(passwordResetRepository.countRecentByEmail).toHaveBeenCalledWith(
        email,
        expect.any(Date),
      );

      expect(passwordResetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          userId: mockUser.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
          usedAt: null,
        }),
      );

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(String),
      );

      expect(result).toEqual({
        message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu',
      });
    });

    it('không gửi email nếu email không tồn tại nhưng vẫn tạo reset record', async () => {
      userService.findByEmail.mockResolvedValue(null);

      passwordResetRepository.create.mockResolvedValue({
        id: 'reset-id-1',
      } as any);

      const result = await service.forgotPassword(email);

      expect(userService.findByEmail).toHaveBeenCalledWith(email);

      expect(passwordResetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          userId: null,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
          usedAt: null,
        }),
      );

      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();

      expect(result).toEqual({
        message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu',
      });
    });

    it('throw PASSWORD_RESET_RATE_LIMITED khi vượt quá số lần cho phép', async () => {
      passwordResetRepository.countRecentByEmail.mockResolvedValue(5);

      await expect(service.forgotPassword(email)).rejects.toMatchObject({
        errorCode: ErrorCode.PASSWORD_RESET_RATE_LIMITED,
      });

      expect(userService.findByEmail).not.toHaveBeenCalled();

      expect(passwordResetRepository.create).not.toHaveBeenCalled();

      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('đếm request gần đây với đúng email và windowStart', async () => {
      passwordResetRepository.countRecentByEmail.mockResolvedValue(0);
      userService.findByEmail.mockResolvedValue(null);

      await service.forgotPassword(email);

      expect(passwordResetRepository.countRecentByEmail).toHaveBeenCalledWith(
        email,
        expect.any(Date),
      );
    });
  });
  // ---------------------------------------------------------------------
  // resetPassword
  // ---------------------------------------------------------------------
  describe('resetPassword', () => {
    const token = 'raw-reset-token';
    const newPassword = 'new-password';

    it('đặt lại mật khẩu thành công', async () => {
      passwordResetRepository.findValidByHash.mockResolvedValue({
        id: 'reset-id-1',
        userId: mockUser.id,
        email: mockUser.email,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      } as any);

      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      userService.changePassword.mockResolvedValue(mockUser as any);

      passwordResetRepository.markUsed.mockResolvedValue({} as any);

      const result = await service.resetPassword(token, newPassword);

      expect(passwordResetRepository.findValidByHash).toHaveBeenCalledWith(expect.any(String));

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);

      expect(userService.changePassword).toHaveBeenCalledWith(mockUser.id, 'new-hashed-password');

      expect(passwordResetRepository.markUsed).toHaveBeenCalledWith('reset-id-1');

      expect(result).toEqual({
        message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại',
      });
    });

    it('throw PASSWORD_RESET_TOKEN_INVALID nếu token không tồn tại hoặc đã hết hạn', async () => {
      passwordResetRepository.findValidByHash.mockResolvedValue(null);

      await expect(service.resetPassword(token, newPassword)).rejects.toMatchObject({
        errorCode: ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
      });

      expect(bcrypt.hash).not.toHaveBeenCalled();

      expect(userService.changePassword).not.toHaveBeenCalled();

      expect(passwordResetRepository.markUsed).not.toHaveBeenCalled();
    });

    it('throw PASSWORD_RESET_TOKEN_INVALID nếu reset record không có userId', async () => {
      passwordResetRepository.findValidByHash.mockResolvedValue({
        id: 'reset-id-1',
        userId: null,
        email: mockUser.email,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      } as any);

      await expect(service.resetPassword(token, newPassword)).rejects.toMatchObject({
        errorCode: ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
      });

      expect(bcrypt.hash).not.toHaveBeenCalled();

      expect(userService.changePassword).not.toHaveBeenCalled();

      expect(passwordResetRepository.markUsed).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // getMe
  // ---------------------------------------------------------------------
  describe('getMe', () => {
    it('lấy thông tin user hiện tại thành công, không trả về password', async () => {
      userService.findById.mockResolvedValue({
        ...mockUser,
        password: 'hashed-password',
      } as any);

      const result = await service.getMe(mockUser.id);

      expect(userService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect((result as any).password).toBeUndefined();
    });

    it('throw AUTH_ACCOUNT_LOCKED nếu user bị khoá', async () => {
      userService.findById.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(service.getMe(mockUser.id)).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_ACCOUNT_LOCKED,
      });
    });

    it('throw USER_NOT_FOUND nếu không tìm thấy user', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.getMe('non-existent-id')).rejects.toMatchObject({
        errorCode: ErrorCode.USER_NOT_FOUND,
      });
    });
  });

  // ---------------------------------------------------------------------
  // Google OAuth & Internal Mapping
  // ---------------------------------------------------------------------
  describe('Google OAuth & Internal Mapping', () => {
    const googleProfile = {
      googleId: 'google-123456',
      email: 'google.user@example.com',
      fullName: 'Google User',
      avatar: 'https://example.com/avatar.jpg',
    };

    beforeEach(() => {
      jwtService.sign.mockReturnValue('mock-jwt-token');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      sessionRepository.create.mockResolvedValue({} as any);
    });

    it('map thành công với user đã có googleId trong hệ thống', async () => {
      userService.findByGoogleId.mockResolvedValue({
        ...mockUser,
        googleId: googleProfile.googleId,
      } as any);

      const result = await service.validateOAuthLogin(googleProfile, {
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      });

      expect(userService.findByGoogleId).toHaveBeenCalledWith(googleProfile.googleId);
      expect(userService.findByEmail).not.toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('map thành công với tài khoản nội bộ có cùng email (chưa có googleId) và cập nhật thông tin', async () => {
      userService.findByGoogleId.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        email: googleProfile.email,
        googleId: undefined,
        avatar: undefined,
      } as any);
      userService.update.mockResolvedValue({
        ...mockUser,
        email: googleProfile.email,
        googleId: googleProfile.googleId,
        avatar: googleProfile.avatar,
      } as any);

      const result = await service.validateOAuthLogin(googleProfile);

      expect(userService.findByGoogleId).toHaveBeenCalledWith(googleProfile.googleId);
      expect(userService.findByEmail).toHaveBeenCalledWith(googleProfile.email);
      expect(userService.update).toHaveBeenCalledWith(mockUser.id, {
        googleId: googleProfile.googleId,
        avatar: googleProfile.avatar,
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('tự động tạo tài khoản nội bộ mới khi chưa tồn tại trong hệ thống', async () => {
      userService.findByGoogleId.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue({
        id: 'new-user-id',
        email: googleProfile.email,
        fullName: googleProfile.fullName,
        role: 'user',
        isActive: true,
      } as any);

      const result = await service.validateOAuthLogin(googleProfile);

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: googleProfile.email,
          fullName: googleProfile.fullName,
          googleId: googleProfile.googleId,
          authProvider: 'google',
          role: 'user',
          isActive: true,
        }),
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throw AUTH_ACCOUNT_LOCKED nếu tài khoản nội bộ bị khoá', async () => {
      userService.findByGoogleId.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(service.validateOAuthLogin(googleProfile)).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_ACCOUNT_LOCKED,
      });
    });

    it('throw AUTH_GOOGLE_MISSING_EMAIL nếu profile thiếu email', async () => {
      await expect(
        service.validateOAuthLogin({ ...googleProfile, email: '' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_GOOGLE_MISSING_EMAIL,
      });
    });

    it('throw AUTH_CANNOT_PROCESS_USER nếu không xử lý được user', async () => {
      userService.findByGoogleId.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(null as any);

      await expect(service.validateOAuthLogin(googleProfile)).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_CANNOT_PROCESS_USER,
      });
    });

    it('throw AUTH_PASSWORD_NOT_SET nếu user OAuth không có password cố đăng nhập qua form email/password', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        password: '',
      } as any);

      await expect(
        service.login({ email: mockUser.email, password: 'password123' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AUTH_PASSWORD_NOT_SET,
      });
    });
  });
});
