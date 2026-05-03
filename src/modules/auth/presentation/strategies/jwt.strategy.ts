import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtSigner } from '../../infrastructure/crypto/jwt-signer';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(ConfigService) _config: ConfigService, signer: JwtSigner) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: signer.getPublicKey(),
      algorithms: ['RS256'],
    });
  }

  validate(payload: { sub: string; sid: string }): AuthenticatedUser {
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
