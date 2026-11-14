import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  Res,
  Get,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleAuthProfile } from './interfaces/google-profile.interface';
import { SuccessMessage } from '@common/constants/success-message.constant';
import {
  REFRESH_TOKEN_COOKIE_KEY,
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from './constants/auth.constant';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction =
      this.configService.get<string>('app.env') === 'production' ||
      this.configService.get<boolean>('app.isProduction') === true;
  }

  /**
   * Helper lấy cookie options từ cấu hình app.cookie
   */
  private getCookieOptions(clear = false) {
    const cookieConfig = this.configService.get<{
      sameSite?: 'lax' | 'strict' | 'none';
      secure?: boolean;
      path?: string;
    }>('app.cookie');

    const opts = {
      isProduction: this.isProduction,
      sameSite: cookieConfig?.sameSite,
      secure: cookieConfig?.secure || this.isProduction,
      path: cookieConfig?.path,
    };

    return clear ? getClearRefreshTokenCookieOptions(opts) : getRefreshTokenCookieOptions(opts);
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary:
      'Đăng nhập bằng email/password, trả về access token và set refresh token qua httpOnly cookie',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.cookie(
      REFRESH_TOKEN_COOKIE_KEY,
      result.refreshToken,
      this.getCookieOptions(),
    );

    return {
      message: SuccessMessage.AUTH_LOGIN_SUCCESS,
      data: {
        accessToken: result.accessToken,
      },
    };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { message: SuccessMessage.AUTH_REGISTER_SUCCESS, data: result };
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Chuyển hướng đến Google để xác thực OAuth2' })
  googleAuth() {
    // Luồng Passport Google OAuth2 tự động chuyển hướng người dùng sang Google consent screen
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({
    summary: 'Callback Google OAuth2, map với tài khoản nội bộ và redirect về Frontend kèm token',
  })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleAuthProfile;
    const result = await this.authService.validateOAuthLogin(profile, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.cookie(
      REFRESH_TOKEN_COOKIE_KEY,
      result.refreshToken,
      this.getCookieOptions(),
    );

    const frontendUrl =
      this.configService.get<string>('app.frontendUrl') || 'http://localhost:5173';

    return res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${encodeURIComponent(result.accessToken)}`,
    );
  }

  @Public()
  @Post('google')
  @ApiOperation({
    summary: 'Đăng nhập bằng Google ID Token (One-Tap / SDK Frontend), map với tài khoản nội bộ',
  })
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithGoogleToken(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.cookie(
      REFRESH_TOKEN_COOKIE_KEY,
      result.refreshToken,
      this.getCookieOptions(),
    );

    return {
      message: SuccessMessage.AUTH_GOOGLE_LOGIN_SUCCESS,
      data: {
        accessToken: result.accessToken,
      },
    };
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @ApiOperation({
    summary: 'Cấp lại access/refresh token từ refresh token còn hạn (hỗ trợ httpOnly cookie)',
  })
  async refresh(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
    @Body() _dto?: RefreshTokenDto,
  ) {
    const result = await this.authService.refresh(user.sub, user.email, user.role);

    res.cookie(
      REFRESH_TOKEN_COOKIE_KEY,
      result.refreshToken,
      this.getCookieOptions(),
    );

    return {
      message: SuccessMessage.AUTH_REFRESH_TOKEN_SUCCESS,
      data: {
        accessToken: result.accessToken,
      },
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất, vô hiệu hoá refresh token và xoá cookie' })
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto?: LogoutDto,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_KEY] || dto?.refreshToken;
    await this.authService.logout(user.sub, refreshToken);

    res.clearCookie(
      REFRESH_TOKEN_COOKIE_KEY,
      this.getCookieOptions(true),
    );

    return { message: SuccessMessage.AUTH_LOGOUT_SUCCESS };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  async getMe(@CurrentUser() user: any) {
    const data = await this.authService.getMe(user.sub);
    return { message: SuccessMessage.AUTH_GET_ME_SUCCESS, data };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: any) {
    await this.authService.changePassword(user.sub, dto.oldPassword, dto.newPassword);

    return { message: SuccessMessage.AUTH_CHANGE_PASSWORD_SUCCESS };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Danh sách thiết bị đang đăng nhập' })
  async getSessions(@CurrentUser() user: any, @Req() req: Request) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_KEY];
    const sessions = await this.authService.getSessions(user.sub, refreshToken);
    return { message: SuccessMessage.AUTH_GET_SESSIONS_SUCCESS, data: sessions };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('sessions/all')
  @ApiOperation({ summary: 'Đăng xuất khỏi tất cả các thiết bị' })
  async revokeAllSessions(@CurrentUser() user: any) {
    await this.authService.revokeAllSessions(user.sub);
    return { message: SuccessMessage.AUTH_REVOKE_ALL_SESSIONS_SUCCESS };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Đăng xuất từ xa một thiết bị cụ thể' })
  async revokeSession(@CurrentUser() user: any, @Param('id') sessionId: string) {
    await this.authService.revokeSession(user.sub, sessionId);
    return { message: SuccessMessage.AUTH_REVOKE_SESSION_SUCCESS };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('sessions')
  @ApiOperation({ summary: 'Đăng xuất tất cả thiết bị khác (giữ lại thiết bị hiện tại)' })
  async revokeOtherSessions(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query('all') all?: string,
    @Body() dto?: LogoutDto,
  ) {
    if (all === 'true' || all === '1') {
      await this.authService.revokeAllSessions(user.sub);
      return { message: SuccessMessage.AUTH_REVOKE_ALL_SESSIONS_SUCCESS };
    }

    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_KEY] || dto?.refreshToken;
    if (!refreshToken) {
      await this.authService.revokeAllSessions(user.sub);
      return { message: SuccessMessage.AUTH_REVOKE_ALL_SESSIONS_SUCCESS };
    }

    await this.authService.revokeOtherSessions(user.sub, refreshToken);
    return { message: SuccessMessage.AUTH_REVOKE_OTHER_SESSIONS_SUCCESS };
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Yêu cầu gửi link đặt lại mật khẩu qua email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      message: SuccessMessage.AUTH_FORGOT_PASSWORD_INFO,
    };
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng token nhận được qua email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: SuccessMessage.AUTH_RESET_PASSWORD_SUCCESS };
  }
}
