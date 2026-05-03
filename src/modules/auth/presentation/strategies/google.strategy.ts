import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { Email } from '../../domain/value-objects/email';
import { OAuthProfile } from '../../domain/value-objects/oauth-profile';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    void accessToken;
    void refreshToken;
    const emailRaw = profile.emails?.[0]?.value;
    if (!emailRaw) {
      done(new Error('OAUTH_MISSING_EMAIL'), undefined);
      return;
    }
    const email = Email.create(emailRaw);
    if (email.isErr()) {
      done(new Error('OAUTH_MISSING_EMAIL'), undefined);
      return;
    }
    const oauthProfile = OAuthProfile.create({
      provider: 'google',
      providerAccountId: profile.id,
      email: email.value,
      name: profile.displayName || emailRaw.split('@')[0]!,
      emailVerifiedByProvider: profile.emails?.[0]?.verified !== false,
    });
    done(null, oauthProfile);
  }
}
