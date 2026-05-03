import { Injectable } from '@nestjs/common';
import type { OneTimeToken as PrismaOneTimeToken } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  OneTimeToken,
  OneTimeTokenId,
  type OneTimeTokenPurpose,
} from '../../domain/entities/one-time-token';
import type { IOneTimeTokenRepository } from '../../domain/ports/one-time-token.repository';

@Injectable()
export class PrismaOneTimeTokenRepository implements IOneTimeTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByHash(hash: string): Promise<OneTimeToken | null> {
    const row = await this.prisma.oneTimeToken.findUnique({ where: { hash } });
    return row ? this.toDomain(row) : null;
  }

  async save(token: OneTimeToken): Promise<void> {
    const s = token.toSnapshot();
    await this.prisma.oneTimeToken.upsert({
      where: { id: s.id.value },
      create: {
        id: s.id.value,
        hash: s.hash,
        purpose: s.purpose,
        userId: s.userId,
        expiresAt: s.expiresAt,
        usedAt: s.usedAt,
        createdAt: s.createdAt,
      },
      update: {
        usedAt: s.usedAt,
      },
    });
  }

  async invalidateAllForUser(
    userId: string,
    purpose: OneTimeTokenPurpose,
    now: Date,
  ): Promise<void> {
    await this.prisma.oneTimeToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    });
  }

  private toDomain(row: PrismaOneTimeToken): OneTimeToken {
    return OneTimeToken.rehydrate({
      id: OneTimeTokenId.of(row.id),
      hash: row.hash,
      purpose: row.purpose as OneTimeTokenPurpose,
      userId: row.userId,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
    });
  }
}
