import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token (RS256). Cliente lo guarda en memoria.' })
  accessToken!: string;

  @ApiProperty({ description: 'TTL del access token en segundos.' })
  accessTokenExpiresInSec!: number;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  sessionId!: string;
}
