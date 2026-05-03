import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import type { ISessionRepository } from '../../domain/ports/session.repository';
import { Session, SessionId } from '../../domain/entities/session';

@Injectable()
export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: SessionId): Promise<Session | null> {
    const row = await this.prisma.session.findUnique({ where: { id: id.value } });
    if (!row) return null;
    return Session.rehydrate({
      id: SessionId.of(row.id),
      userId: row.userId,
      userAgent: row.userAgent,
      ip: row.ip,
      createdAt: row.createdAt,
      lastSeen: row.lastSeen,
      revokedAt: row.revokedAt,
    });
  }

  async save(session: Session): Promise<void> {
    const s = session.toSnapshot();
    await this.prisma.session.upsert({
      where: { id: s.id.value },
      create: {
        id: s.id.value,
        userId: s.userId,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastSeen: s.lastSeen,
        revokedAt: s.revokedAt,
      },
      update: {
        lastSeen: s.lastSeen,
        revokedAt: s.revokedAt,
      },
    });
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
