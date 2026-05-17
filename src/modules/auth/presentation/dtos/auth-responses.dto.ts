import { ApiProperty } from '@nestjs/swagger';

export class EmailVerifiedResponseDto {
  @ApiProperty({ example: true, enum: [true] })
  verified!: true;
}

export class AcceptedResponseDto {
  @ApiProperty({
    example: true,
    enum: [true],
    description: 'Siempre 202/true: respuesta idéntica exista o no el email (anti-enumeration).',
  })
  accepted!: true;
}

export class PasswordUpdatedResponseDto {
  @ApiProperty({ example: true, enum: [true] })
  updated!: true;
}

export class OAuthCallbackResponseDto {
  @ApiProperty({ description: 'JWT access token (RS256).' })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'TTL del access token en segundos.' })
  accessTokenExpiresInSec!: number;

  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7', format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'a1b2c3d4-5e6f-4789-90ab-cdef01234567', format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    example: false,
    description: 'true si se creó un usuario nuevo en este callback.',
  })
  created!: boolean;

  @ApiProperty({
    example: false,
    description: 'true si se vinculó el provider a una cuenta existente.',
  })
  linked!: boolean;
}
