import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskResponseDto } from '../../tasks/dto/task-response.dto';

export class UserSettingsResponseDto {
  @ApiPropertyOptional({ enum: ['dark', 'light', 'predetermined'] })
  theme?: 'dark' | 'light' | 'predetermined';

  @ApiPropertyOptional()
  notifications?: boolean;

  @ApiPropertyOptional({ enum: ['es', 'en'] })
  language?: 'es' | 'en';
}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Adrian' })
  name: string;

  @ApiProperty({ example: 'adrian@test.com' })
  email: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: UserSettingsResponseDto, nullable: true })
  settings: UserSettingsResponseDto | null;

  @ApiProperty({ example: '2025-12-23T14:21:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: () => [TaskResponseDto] })
  tasks: TaskResponseDto[];
}
