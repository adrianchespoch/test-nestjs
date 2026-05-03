import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-github2';
import { Email } from '../../domain/value-objects/email';
import { OAuthProfile } from '../../domain/value-objects/oauth-profile';

type DoneCallback = (err: Error | null, user?: unknown) => void;

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? '',
      callbackURL: config.get<string>('GITHUB_CALLBACK_URL') ?? '',
      scope: ['user:email'],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: Profile, done: DoneCallback): void {
    void accessToken;
    void refreshToken;
    // GitHub puede no devolver email primario; passport-github2 ya intenta /user/emails
    // si pasamos scope 'user:email'. Asumimos que profile.emails contiene el primary verified.
    const verifiedEmail = profile.emails?.find(
      (e) => (e as { primary?: boolean }).primary !== false,
    )?.value;
    if (!verifiedEmail) {
      done(new Error('OAUTH_MISSING_EMAIL'));
      return;
    }
    const email = Email.create(verifiedEmail);
    if (email.isErr()) {
      done(new Error('OAUTH_MISSING_EMAIL'));
      return;
    }
    const oauthProfile = OAuthProfile.create({
      provider: 'github',
      providerAccountId: String(profile.id),
      email: email.value,
      name: profile.displayName || profile.username || verifiedEmail.split('@')[0]!,
      emailVerifiedByProvider: true,
    });
    done(null, oauthProfile);
  }
}
