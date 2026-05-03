import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class ResendVerificationDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
