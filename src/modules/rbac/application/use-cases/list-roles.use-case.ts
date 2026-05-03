import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import { ROLE_REPOSITORY, type IRoleRepository } from '../../domain/ports/role.repository';

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
}

@Injectable()
export class ListRolesUseCase {
  constructor(@Inject(ROLE_REPOSITORY) private readonly roles: IRoleRepository) {}

  async execute(): Promise<Result<RoleSummary[], never>> {
    const roles = await this.roles.findAll();
    return Result.ok(
      roles.map((r) => ({
        id: r.id.value,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissionKeys: r.permissions.map((p) => `${p.action}:${p.subject}`),
      })),
    );
  }
}
