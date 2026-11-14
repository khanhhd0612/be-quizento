import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '@modules/user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { TokenBlacklistRepository } from './repositories/token-blacklist.repository';
import { SessionRepository } from './repositories/session.repository';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { MailService } from '@/shared/mail/mail.service';
import { BlacklistedToken, BlacklistedTokenSchema } from './entities/blacklisted-token.entity';
import { UserSession, UserSessionSchema } from './entities/user-session.entity';
import {
  PasswordResetToken,
  PasswordResetTokenSchema,
} from './entities/password-reset-token.entity';

@Module({
  imports: [
    UserModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: BlacklistedToken.name, schema: BlacklistedTokenSchema },
      { name: UserSession.name, schema: UserSessionSchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessExpiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
    TokenBlacklistRepository,
    SessionRepository,
    PasswordResetRepository,
    MailService,
  ],
  exports: [AuthService, GoogleAuthGuard],
})
export class AuthModule {}
