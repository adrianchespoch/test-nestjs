import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Role } from '../../domain/entities/role';
import { Permission } from '../../domain/entities/permission';
import { PermissionId, RoleId } from '../../domain/value-objects/role-id';
import type { IRoleRepository } from '../../domain/ports/role.repository';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PrismaRoleRepository implements IRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: RoleId): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({
      where: { id: id.value },
      include: { permissions: { include: { permission: true } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({
      where: { name },
      include: { permissions: { include: { permission: true } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async countAssignedUsers(id: RoleId): Promise<number> {
    return this.prisma.userRole.count({ where: { roleId: id.value } });
  }

  async save(role: Role): Promise<void> {
    const s = role.toSnapshot();
    await this.prisma.$transaction(async (tx) => {
      await tx.role.upsert({
        where: { id: s.id.value },
        create: {
          id: s.id.value,
          name: s.name,
          description: s.description,
          isSystem: s.isSystem,
          createdAt: s.createdAt,
        },
        update: {
          description: s.description,
          // name + isSystem inmutable post-create
        },
      });

      // Reemplaza el set completo de role_permission rows.
      await tx.rolePermission.deleteMany({ where: { roleId: s.id.value } });
      if (s.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: s.permissions.map((p) => ({
            roleId: s.id.value,
            permissionId: p.id.value,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async delete(id: RoleId): Promise<void> {
    await this.prisma.role.delete({ where: { id: id.value } });
  }

  private toDomain(
    row: Prisma.RoleGetPayload<{ include: { permissions: { include: { permission: true } } } }>,
  ): Role {
    return Role.rehydrate({
      id: RoleId.fromString(row.id),
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      createdAt: row.createdAt,
      permissions: row.permissions.map((rp) =>
        Permission.rehydrate({
          id: PermissionId.fromString(rp.permission.id),
          action: rp.permission.action,
          subject: rp.permission.subject,
          conditions: this.toConditions(rp.permission.conditions),
          description: rp.permission.description,
        }),
      ),
    });
  }

  private toConditions(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }
}
