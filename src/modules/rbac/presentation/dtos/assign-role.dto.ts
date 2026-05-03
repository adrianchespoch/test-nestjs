import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z][a-z0-9_-]{1,58}$/, {
    message: 'roleName must match /^[a-z][a-z0-9_-]{1,58}$/',
  })
  roleName!: string;
}
