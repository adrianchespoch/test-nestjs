import type { User as PrismaUser } from '@prisma/client';
import { Email } from '../../../domain/value-objects/email';
import { HashedPassword } from '../../../domain/value-objects/password';
import { UserId } from '../../../domain/value-objects/user-id';
import { User } from '../../../domain/entities/user';

export class UserMapper {
  static toDomain(row: PrismaUser): User {
    return User.rehydrate({
      id: UserId.fromString(row.id),
      email: Email.fromTrustedString(row.email),
      name: row.name,
      passwordHash: row.passwordHash ? HashedPassword.fromHash(row.passwordHash) : null,
      emailVerifiedAt: row.emailVerifiedAt,
      failedLoginAttempts: row.failedLoginAttempts,
      lockedUntil: row.lockedUntil,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(user: User): Omit<PrismaUser, 'createdAt' | 'updatedAt'> & {
    createdAt: Date;
    updatedAt: Date;
  } {
    const s = user.toSnapshot();
    return {
      id: s.id.value,
      email: s.email.value,
      name: s.name,
      passwordHash: s.passwordHash?.value ?? null,
      emailVerifiedAt: s.emailVerifiedAt,
      failedLoginAttempts: s.failedLoginAttempts,
      lockedUntil: s.lockedUntil,
      isActive: s.isActive,
      mustChangePassword: s.mustChangePassword,
      deletedAt: s.deletedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
