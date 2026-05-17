import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import type {
  AccessTokenPayload,
  IJwtSigner,
  SignedAccessToken,
} from '../../domain/ports/jwt-signer.port';

@Injectable()
export class JwtSigner implements IJwtSigner {
  private readonly logger = new Logger(JwtSigner.name);
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessTtlSec: number;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    // Resuelto en el constructor (no onModuleInit): JwtStrategy lee
    // getPublicKey() en su propio constructor y Nest corre todos los
    // constructores antes que cualquier hook de lifecycle.
    this.accessTtlSec = this.config.get<number>('JWT_ACCESS_TTL_SEC') ?? 900;
    let priv = this.config.get<string>('JWT_PRIVATE_KEY') ?? '';
    let pub = this.config.get<string>('JWT_PUBLIC_KEY') ?? '';

    if ((!priv || !pub) && this.isDev()) {
      const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
      priv = pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
      pub = pair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
      this.logger.warn(
        'JWT_PRIVATE_KEY/PUBLIC_KEY not provided; generated ephemeral RS256 keypair (dev only). Tokens invalidate on restart.',
      );
    }

    if (!priv || !pub) {
      throw new Error(
        'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required outside development. Generate with `openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048`.',
      );
    }

    this.privateKey = priv;
    this.publicKey = pub;
  }

  async signAccessToken(payload: AccessTokenPayload): Promise<SignedAccessToken> {
    const token = await this.jwt.signAsync(
      { sub: payload.sub, sid: payload.sid },
      {
        algorithm: 'RS256',
        privateKey: this.privateKey,
        expiresIn: this.accessTtlSec,
      },
    );
    return { token, expiresInSec: this.accessTtlSec };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      algorithms: ['RS256'],
      publicKey: this.publicKey,
    });
  }

  /** Útil para JwtStrategy: la clave pública para verificación. */
  getPublicKey(): string {
    return this.publicKey;
  }

  private isDev(): boolean {
    const env = this.config.get<string>('NODE_ENV');
    return env === 'dev' || env === 'test';
  }
}
