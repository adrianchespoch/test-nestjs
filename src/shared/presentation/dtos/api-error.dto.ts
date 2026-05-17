import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape estándar de error que emite GlobalExceptionFilter.
 * Reutilizable en `@ApiResponse({ type: ApiErrorDto })` de cualquier módulo.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({ example: 'FORBIDDEN' })
  code!: string;

  @ApiProperty({ example: 'Insufficient permissions' })
  message!: string;

  @ApiProperty({ example: '/api/v1/rbac/roles' })
  path!: string;

  @ApiProperty({ example: 'b3c1f0a2-9d4e-4a7c-8f21-1e5b6c7d8a90', required: false })
  requestId?: string;

  @ApiProperty({ example: '2026-05-17T16:55:55.824Z' })
  timestamp!: string;

  @ApiProperty({
    required: false,
    description: 'Detalle opcional (ej. errores de validación).',
    example: { roleName: 'roleName must match /^[a-z][a-z0-9_-]{1,58}$/' },
  })
  details?: unknown;
}
