import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode, ErrorMessage } from '@common/constants/error-code.constant';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const clientId = this.configService.get<string>('app.google.clientId');
    const clientSecret = this.configService.get<string>('app.google.clientSecret');

    if (
      !clientId ||
      !clientSecret ||
      clientId === 'google-client-id-placeholder' ||
      clientSecret === 'google-client-secret-placeholder'
    ) {
      throw new BusinessException(
        ErrorCode.AUTH_GOOGLE_NOT_CONFIGURED,
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorMessage[ErrorCode.AUTH_GOOGLE_NOT_CONFIGURED],
      );
    }

    return super.canActivate(context);
  }
}
