import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type {
  GeneratedRefreshToken,
  IRefreshTokenGenerator,
} from '../../domain/ports/refresh-token-generator.port';

@Injectable()
export class RefreshTokenGenerator implements IRefreshTokenGenerator {
  generate(): GeneratedRefreshToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashOf(raw) };
  }

  hashOf(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
