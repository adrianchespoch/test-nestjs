import { ApiProperty } from '@nestjs/swagger';

export class PermissionResponseDto {
  @ApiProperty({ example: 'd1f8c2a4-5b6e-4c3d-9a7f-2e1b0c4d6f8a', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'update', description: 'Acción CASL.' })
  action!: string;

  @ApiProperty({ example: 'User', description: 'Subject CASL.' })
  subject!: string;

  @ApiProperty({
    nullable: true,
    description: 'Condiciones ABAC (CASL). Placeholders `$user.id` se resuelven por request.',
    example: { ownerId: '$user.id' },
  })
  conditions!: Record<string, unknown> | null;

  @ApiProperty({ example: 'Unlock a locked-out user account', nullable: true })
  description!: string | null;
}
