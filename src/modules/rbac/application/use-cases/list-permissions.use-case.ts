import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../../shared/domain/result';
import {
  PERMISSION_REPOSITORY,
  type IPermissionRepository,
} from '../../domain/ports/permission.repository';

export interface PermissionSummary {
  id: string;
  action: string;
  subject: string;
  conditions: Record<string, unknown> | null;
  description: string | null;
}

@Injectable()
export class ListPermissionsUseCase {
  constructor(@Inject(PERMISSION_REPOSITORY) private readonly permissions: IPermissionRepository) {}

  async execute(): Promise<Result<PermissionSummary[], never>> {
    const all = await this.permissions.findAll();
    return Result.ok(
      all.map((p) => ({
        id: p.id.value,
        action: p.action,
        subject: p.subject,
        conditions: p.conditions ? { ...p.conditions } : null,
        description: p.description,
      })),
    );
  }
}
