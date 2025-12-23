import { ApiProperty } from '@nestjs/swagger';

export class TaskResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Comprar router' })
  title: string;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiProperty({ example: '2025-12-23T14:21:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: 1 })
  userId: number;
}
