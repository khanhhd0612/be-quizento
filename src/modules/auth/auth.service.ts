import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';
import { SuccessMessage } from '@common/constants/success-message.constant';
import { BusinessException } from '@common/exceptions/business.exception';
import { UserService } from '@modules/user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleAuthProfile } from './interfaces/google-profile.interface';
import { v4 as uuidv4 } from 'uuid';
import { TokenBlacklistRepository } from './repositories/token-blacklist.repository';
import { SessionRepository } from './repositories/session.repository';
import { parseDeviceName } from '@common/utils/device.util';
import { generateRawToken, hashToken } from '@common/utils/token-hash.util';
import { MailService } from '@shared/mail/mail.service';
import { PasswordResetRepository } from './repositories/password-reset.repository';

interface DeviceInfo {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistRepository: TokenBlacklistRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly mailService: MailService,
  ) {
    this.googleClient = new OAuth2Client();
  }

  private readonly RESET_TOKEN_TTL_MINUTES = 15;
  private readonly RESET_RATE_LIMIT_WINDOW_MINUTES = 60;
  private readonly RESET_RATE_LIMIT_MAX_REQUESTS = 3;

  async login(dto: LoginDto, deviceInfo?: DeviceInfo): Promise<AuthResponseDto> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new BusinessException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        ErrorMessage[ErrorCode.AUTH_INVALID_CREDENTIALS],
      );
    }

    if (!user.password) {
      throw new BusinessException(
        ErrorCode.AUTH_PASSWORD_NOT_SET,
        HttpStatus.UNAUTHORIZED,
        ErrorMessage[ErrorCode.AUTH_PASSWORD_NOT_SET],
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) {
      throw new BusinessException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
        ErrorMessage[ErrorCode.AUTH_INVALID_CREDENTIALS],
      );
    }
    if (!user.isActive) {
      throw new BusinessException(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.AUTH_ACCOUNT_LOCKED],
      );
    }

    return this.generateTokens(
      { sub: (user.id ?? user._id)?.toString(), email: user.email, role: user.role },
      { userAgent: deviceInfo?.userAgent, ip: deviceInfo?.ip },
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.userService.findByEmail(dto.email);

    if (existing) {
      throw new BusinessException(
        ErrorCode.USER_EMAIL_ALREADY_EXISTS,
        HttpStatus.CONFLICT,
        ErrorMessage[ErrorCode.USER_EMAIL_ALREADY_EXISTS],
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.userService.create({
        ...dto,
        password: passwordHash,
        deletedAt: null,
      });

      const userObj =
        user && typeof (user as any).toObject === 'function'
          ? (user as any).toObject()
          : { ...(user as Record<string, any>) };
      delete userObj.password;

      return userObj;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BusinessException(
          ErrorCode.USER_EMAIL_ALREADY_EXISTS,
          HttpStatus.CONFLICT,
          ErrorMessage[ErrorCode.USER_EMAIL_ALREADY_EXISTS],
        );
      }
      throw err;
    }
  }

  /**
   * Ánh xạ (mapping) tài khoản Google OAuth với tài khoản nội bộ:
   * 1. Tìm kiếm tài khoản nội bộ theo googleId hoặc email.
   * 2. Nếu đã tồn tại: cập nhật googleId (nếu chưa liên kết) và avatar, dùng tài khoản nội bộ này.
   * 3. Nếu chưa tồn tại: tự động tạo tài khoản nội bộ mới (role: 'user', authProvider: 'google', password: null).
   * 4. Kiểm tra tài khoản có bị khoá hay không (isActive).
   * 5. Sinh Access Token + Refresh Token và lưu phiên đăng nhập (Session) như tài khoản nội bộ thông thường.
   */
  async validateOAuthLogin(
    profile: GoogleAuthProfile,
    deviceInfo?: DeviceInfo,
  ): Promise<AuthResponseDto> {
    const email = profile.email?.toLowerCase().trim();
    if (!email) {
      throw new BusinessException(
        ErrorCode.AUTH_GOOGLE_MISSING_EMAIL,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.AUTH_GOOGLE_MISSING_EMAIL],
      );
    }

    // 1. Tìm kiếm tài khoản nội bộ theo googleId trước, sau đó theo email
    let user = profile.googleId ? await this.userService.findByGoogleId(profile.googleId) : null;

    if (!user) {
      user = await this.userService.findByEmail(email);

      if (user) {
        // Tài khoản nội bộ đã tồn tại (ví dụ đã đăng ký bằng email/password trước đó)
        // -> Map / Liên kết Google ID và avatar vào tài khoản nội bộ
        const updates: Record<string, any> = {};
        if (!user.googleId && profile.googleId) {
          updates.googleId = profile.googleId;
        }
        if (!user.avatar && profile.avatar) {
          updates.avatar = profile.avatar;
        }
        if (Object.keys(updates).length > 0) {
          user = await this.userService.update((user.id ?? (user as any)._id).toString(), updates);
        }
      } else {
        // Chưa tồn tại tài khoản nội bộ -> Tự động khởi tạo tài khoản mới
        const createdUser = await this.userService.create({
          email,
          fullName: profile.fullName || email.split('@')[0],
          googleId: profile.googleId,
          avatar: profile.avatar || null,
          authProvider: 'google',
          role: 'user',
          isActive: true,
          tokenValidAfter: new Date(),
          deletedAt: null,
        });
        user = createdUser;
      }
    }

    if (!user) {
      throw new BusinessException(
        ErrorCode.AUTH_CANNOT_PROCESS_USER,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorMessage[ErrorCode.AUTH_CANNOT_PROCESS_USER],
      );
    }

    // 2. Kiểm tra trạng thái tài khoản nội bộ
    if (!user.isActive) {
      throw new BusinessException(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.AUTH_ACCOUNT_LOCKED],
      );
    }

    // 3. Sinh token nội bộ và lưu phiên đăng nhập
    const userId = (user.id ?? (user as any)._id)?.toString();
    return this.generateTokens(
      { sub: userId, email: user.email, role: user.role },
      { userAgent: deviceInfo?.userAgent, ip: deviceInfo?.ip },
    );
  }

  /**
   * Xác thực Google ID Token (credential) gửi từ Google Sign-In SDK
   */
  async verifyGoogleIdToken(idToken: string): Promise<GoogleAuthProfile> {
    const clientId = this.configService.get<string>('app.google.clientId');

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId && clientId !== 'google-client-id-placeholder' ? clientId : undefined,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new BusinessException(
          ErrorCode.AUTH_GOOGLE_TOKEN_INVALID,
          HttpStatus.UNAUTHORIZED,
          ErrorMessage[ErrorCode.AUTH_GOOGLE_TOKEN_INVALID],
        );
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        fullName: payload.name || payload.email.split('@')[0],
        avatar: payload.picture,
      };
    } catch (error: any) {
      if (error instanceof BusinessException) throw error;
      throw new BusinessException(
        ErrorCode.AUTH_TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED,
        ErrorMessage[ErrorCode.AUTH_TOKEN_INVALID],
      );
    }
  }

  /**
   * Đăng nhập bằng Google ID Token (gửi trực tiếp từ phía frontend)
   */
  async loginWithGoogleToken(
    dto: GoogleLoginDto,
    deviceInfo?: DeviceInfo,
  ): Promise<AuthResponseDto> {
    const profile = await this.verifyGoogleIdToken(dto.idToken);
    return this.validateOAuthLogin(profile, deviceInfo);
  }

  async refresh(userId: string, email: string, role: string): Promise<AuthResponseDto> {
    const user = await this.userService.findOneOrFail(userId);

    if (!user.isActive) {
      throw new BusinessException(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.AUTH_ACCOUNT_LOCKED],
      );
    }

    return this.generateTokens({ sub: userId, email, role });
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const decodedRefresh = this.jwtService.decode(refreshToken) as {
        jti: string;
        exp: number;
      } | null;
      if (decodedRefresh?.jti && decodedRefresh?.exp) {
        await this.tokenBlacklistRepository.create({
          jti: decodedRefresh.jti,
          userId,
          expiresAt: new Date(decodedRefresh.exp * 1000),
        });
      }
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    if (!user.password) {
      throw new BusinessException(
        ErrorCode.AUTH_PASSWORD_NOT_SET,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.AUTH_PASSWORD_NOT_SET],
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BusinessException(
        ErrorCode.INVALID_OLD_PASSWORD,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.INVALID_OLD_PASSWORD],
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await this.userService.changePassword(userId, newHash);
  }

  private async generateTokens(
    payload: { sub: string; email: string; role: string },
    deviceInfo?: { userAgent?: string; ip?: string },
  ): Promise<AuthResponseDto> {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessToken = this.jwtService.sign(
      {
        ...payload,
        jti: accessJti,
      },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        jti: refreshJti,
      },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      },
    );

    const decodedRefresh = this.jwtService.decode(refreshToken) as { exp: number };
    await this.sessionRepository.create({
      userId: payload.sub,
      jti: refreshJti,
      userAgent: deviceInfo?.userAgent,
      ip: deviceInfo?.ip,
      deviceName: parseDeviceName(deviceInfo?.userAgent),
      expiresAt: new Date(decodedRefresh.exp * 1000),
    });

    return { accessToken, refreshToken };
  }

  async getSessions(userId: string, currentRefreshToken?: string) {
    let currentJti: string | null = null;
    if (currentRefreshToken) {
      try {
        const decoded = this.jwtService.decode(currentRefreshToken) as { jti?: string };
        currentJti = decoded?.jti ?? null;
      } catch {
        currentJti = null;
      }
    }

    const sessions = await this.sessionRepository.findActiveByUser(userId);
    return sessions.map((s: any) => ({
      id: (s.id ?? s._id)?.toString(),
      deviceName: s.deviceName,
      ip: s.ip,
      isCurrent: currentJti ? s.jti === currentJti : false,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new BusinessException(
        ErrorCode.SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.SESSION_NOT_FOUND],
      );
    }

    await this.sessionRepository.revoke(sessionId);
    await this.tokenBlacklistRepository.create({
      jti: session.jti,
      userId,
      expiresAt: session.expiresAt,
    });
  }

  async revokeOtherSessions(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      throw new BusinessException(
        ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED],
      );
    }

    const decodedRefresh = this.jwtService.decode(refreshToken) as { jti: string };
    const currentJti = decodedRefresh?.jti;

    const sessions = await this.sessionRepository.findActiveByUser(userId);
    const toRevoke = sessions.filter((s) => s.jti !== currentJti);

    for (const s of toRevoke) {
      await this.tokenBlacklistRepository.create({
        jti: s.jti,
        userId,
        expiresAt: s.expiresAt,
      });
    }

    await this.sessionRepository.revokeAllExcept(userId, currentJti);
  }

  async revokeAllSessions(userId: string) {
    const sessions = await this.sessionRepository.findActiveByUser(userId);
    for (const s of sessions) {
      await this.tokenBlacklistRepository.create({
        jti: s.jti,
        userId,
        expiresAt: s.expiresAt,
      });
    }

    await this.sessionRepository.revokeAll(userId);
  }

  async forgotPassword(email: string) {
    const windowStart = new Date(Date.now() - this.RESET_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

    const recentCount = await this.passwordResetRepository.countRecentByEmail(email, windowStart);

    if (recentCount >= this.RESET_RATE_LIMIT_MAX_REQUESTS) {
      throw new BusinessException(
        ErrorCode.PASSWORD_RESET_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorMessage[ErrorCode.PASSWORD_RESET_RATE_LIMITED],
      );
    }

    const user = await this.userService.findByEmail(email);
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.passwordResetRepository.create({
      email,
      userId: (user?.id ?? user?._id)?.toString() ?? null,
      tokenHash,
      expiresAt,
      usedAt: null,
    });

    if (user) {
      await this.mailService.sendPasswordResetEmail(user.email, rawToken);
    }

    return {
      message: SuccessMessage.AUTH_FORGOT_PASSWORD_INFO,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const record = await this.passwordResetRepository.findValidByHash(tokenHash);

    if (!record || !record.userId) {
      throw new BusinessException(
        ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
        HttpStatus.BAD_REQUEST,
        ErrorMessage[ErrorCode.PASSWORD_RESET_TOKEN_INVALID],
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await this.userService.changePassword((record.userId as any).toString(), newHash);

    await this.passwordResetRepository.markUsed((record.id ?? record._id).toString());

    return {
      message: SuccessMessage.AUTH_RESET_PASSWORD_SUCCESS,
    };
  }

  async getMe(userId: string) {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
      );
    }

    if (!user.isActive) {
      throw new BusinessException(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        HttpStatus.FORBIDDEN,
        ErrorMessage[ErrorCode.AUTH_ACCOUNT_LOCKED],
      );
    }

    return {
      id: user.id ?? user._id?.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
      authProvider: user.authProvider,
    };
  }
}
