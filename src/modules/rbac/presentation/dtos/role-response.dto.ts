import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin' })
  name!: string;

  @ApiProperty({ example: 'Full access except superadmin-only ops', nullable: true })
  description!: string | null;

  @ApiProperty({
    example: true,
    description: 'Rol del sistema (seed). No se puede borrar.',
  })
  isSystem!: boolean;

  @ApiProperty({
    type: [String],
    example: ['read:Role', 'read:Permission', 'update:User', 'unlock:User'],
    description: 'Permisos efectivos en formato `action:subject`.',
  })
  permissionKeys!: string[];
}
