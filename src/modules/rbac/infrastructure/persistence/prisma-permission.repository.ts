import { Injectable } from '@nestjs/common';
import type { Permission as PrismaPermission, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Permission } from '../../domain/entities/permission';
import { PermissionId } from '../../domain/value-objects/role-id';
import { PermissionKey } from '../../domain/value-objects/permission-key';
import type { IPermissionRepository } from '../../domain/ports/permission.repository';

@Injectable()
export class PrismaPermissionRepository implements IPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: PermissionId): Promise<Permission | null> {
    const row = await this.prisma.permission.findUnique({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findByKey(key: PermissionKey): Promise<Permission | null> {
    const row = await this.prisma.permission.findUnique({
      where: { action_subject: { action: key.action, subject: key.subject } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(): Promise<Permission[]> {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findEffectiveForUser(userId: string): Promise<Permission[]> {
    const rows = await this.prisma.permission.findMany({
      where: {
        roles: {
          some: { role: { users: { some: { userId } } } },
        },
      },
      distinct: ['action', 'subject'],
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: PrismaPermission): Permission {
    return Permission.rehydrate({
      id: PermissionId.fromString(row.id),
      action: row.action,
      subject: row.subject,
      conditions: this.toConditions(row.conditions),
      description: row.description,
    });
  }

  private toConditions(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }
}
