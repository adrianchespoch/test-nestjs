import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import type { IUserRoleRepository } from '../../domain/ports/user-role.repository';

@Injectable()
export class PrismaUserRoleRepository implements IUserRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assign(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  async remove(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
  }

  async rolesOfUser(userId: string): Promise<Array<{ id: string; name: string }>> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ id: r.role.id, name: r.role.name }));
  }
}
