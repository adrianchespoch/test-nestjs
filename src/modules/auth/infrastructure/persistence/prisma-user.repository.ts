import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import type { IUserRepository } from '../../domain/ports/user.repository';
import type { User } from '../../domain/entities/user';
import type { Email } from '../../domain/value-objects/email';
import type { UserId } from '../../domain/value-objects/user-id';
import { UserMapper } from './mappers/user.mapper';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: UserId): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id: id.value } });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });
    return row ? UserMapper.toDomain(row) : null;
  }

  async emailExists(email: Email): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email: email.value } });
    return count > 0;
  }

  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);
    await this.prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        emailVerifiedAt: data.emailVerifiedAt,
        failedLoginAttempts: data.failedLoginAttempts,
        lockedUntil: data.lockedUntil,
        isActive: data.isActive,
        mustChangePassword: data.mustChangePassword,
        deletedAt: data.deletedAt,
      },
    });
  }
}
