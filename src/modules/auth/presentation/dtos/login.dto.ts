import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'S3curePass!2026', minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token (RS256). Cliente lo guarda en memoria.',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'TTL del access token en segundos.' })
  accessTokenExpiresInSec!: number;

  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7', format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'a1b2c3d4-5e6f-4789-90ab-cdef01234567', format: 'uuid' })
  sessionId!: string;
}
