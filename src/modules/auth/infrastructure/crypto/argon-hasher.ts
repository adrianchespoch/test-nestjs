import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { IHasher } from '../../domain/ports/hasher.port';
import { HashedPassword, Password } from '../../domain/value-objects/password';

@Injectable()
export class ArgonHasher implements IHasher {
  private readonly memoryCost: number;
  private readonly timeCost: number;
  private readonly parallelism: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.memoryCost = config.get<number>('ARGON2_MEMORY_COST') ?? 65536;
    this.timeCost = config.get<number>('ARGON2_TIME_COST') ?? 3;
    this.parallelism = config.get<number>('ARGON2_PARALLELISM') ?? 1;
  }

  async hash(plain: Password): Promise<HashedPassword> {
    const value = await argon2.hash(plain.value, {
      type: argon2.argon2id,
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
      parallelism: this.parallelism,
    });
    return HashedPassword.fromHash(value);
  }

  async verify(stored: HashedPassword, attempt: string): Promise<boolean> {
    if (typeof attempt !== 'string' || attempt.length === 0) return false;
    try {
      return await argon2.verify(stored.value, attempt);
    } catch {
      return false;
    }
  }
}
