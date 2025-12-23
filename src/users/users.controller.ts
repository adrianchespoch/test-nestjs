import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { TaskResponseDto } from '../tasks/dto/task-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiExtraModels(UserResponseDto, TaskResponseDto)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un usuario' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error / Email duplicado' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post(':userId/tasks')
  @ApiOperation({ summary: 'Crear una tarea asociada a un usuario' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'User no encontrado' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  createTask(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.usersService.createTaskForUser(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los usuarios con sus tareas' })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/settings')
  @ApiOperation({
    summary: 'Actualizar únicamente el campo JSON de configuración del usuario',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User no encontrado' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  patchSettings(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.usersService.updateSettings(id, dto);
  }
}
