import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({ enum: ['dark', 'light', 'predetermined'] })
  @IsOptional()
  @IsIn(['dark', 'light', 'predetermined'])
  theme?: 'dark' | 'light' | 'predetermined';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @ApiPropertyOptional({ enum: ['es', 'en'] })
  @IsOptional()
  @IsIn(['es', 'en'])
  language?: 'es' | 'en';
}
