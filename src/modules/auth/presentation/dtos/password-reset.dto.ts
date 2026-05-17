import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({
    example: 'a3f1c9e2b7d84605f1a2b3c4d5e6f7081920a1b2c3d4e5f60718293a4b5c6d7e',
    description: 'One-time token recibido por email (TTL 30min, single-use).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: 'N3wS3curePass!2026', minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'alice@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
