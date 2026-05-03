import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import type { IRefreshTokenRepository } from '../../domain/ports/refresh-token.repository';
import { RefreshToken, RefreshTokenId } from '../../domain/entities/refresh-token';
import type { RefreshToken as PrismaRefreshToken } from '@prisma/client';

@Injectable()
export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: RefreshTokenId): Promise<RefreshToken | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findByHash(hash: string): Promise<RefreshToken | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { hash } });
    return row ? this.toDomain(row) : null;
  }

  async save(token: RefreshToken): Promise<void> {
    const s = token.toSnapshot();
    await this.prisma.refreshToken.upsert({
      where: { id: s.id.value },
      create: {
        id: s.id.value,
        hash: s.hash,
        familyId: s.familyId,
        parentId: s.parentId,
        sessionId: s.sessionId,
        userId: s.userId,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        reuseDetectedAt: s.reuseDetectedAt,
        createdAt: s.createdAt,
      },
      update: {
        revokedAt: s.revokedAt,
        reuseDetectedAt: s.reuseDetectedAt,
      },
    });
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private toDomain(row: PrismaRefreshToken): RefreshToken {
    return RefreshToken.rehydrate({
      id: RefreshTokenId.of(row.id),
      hash: row.hash,
      familyId: row.familyId,
      parentId: row.parentId,
      sessionId: row.sessionId,
      userId: row.userId,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      reuseDetectedAt: row.reuseDetectedAt,
      createdAt: row.createdAt,
    });
  }
}
