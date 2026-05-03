import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type {
  GeneratedOneTimeToken,
  IOneTimeTokenGenerator,
} from '../../domain/ports/one-time-token-generator.port';

@Injectable()
export class OneTimeTokenGenerator implements IOneTimeTokenGenerator {
  generate(): GeneratedOneTimeToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashOf(raw) };
  }

  hashOf(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
