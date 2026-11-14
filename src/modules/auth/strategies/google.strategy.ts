import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthProfile } from '../interfaces/google-profile.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('app.google.clientId') || 'google-client-id-placeholder',
      clientSecret:
        configService.get<string>('app.google.clientSecret') || 'google-client-secret-placeholder',
      callbackURL:
        configService.get<string>('app.google.callbackUrl') ||
        'http://localhost:3000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, displayName, name, emails, photos } = profile;
    const email = emails?.[0]?.value;

    let fullName = displayName;
    if (!fullName && name) {
      fullName = [name.familyName, name.givenName].filter(Boolean).join(' ');
    }
    if (!fullName && email) {
      fullName = email.split('@')[0];
    }

    const userProfile: GoogleAuthProfile = {
      googleId: id,
      email: email || '',
      fullName: fullName || 'Google User',
      avatar: photos?.[0]?.value,
    };

    done(null, userProfile);
  }
}
