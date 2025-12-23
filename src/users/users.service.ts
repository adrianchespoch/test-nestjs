import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RedisService } from '../redis/redis.service';
import { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { TasksService } from '../tasks/tasks.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { User } from './entities/user.entity';
import { toTaskResponseDto, toUserResponseDto } from './users.mapper';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  private readonly USERS_WITH_TASKS_CACHE_KEY = 'users:all:with_tasks';
  private readonly USERS_WITH_TASKS_TTL_SECONDS = 30;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tasksService: TasksService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateUserDto) {
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      isActive: dto.isActive ?? true,
      settings: dto.settings ?? null,
    });

    const saved = await this.userRepo.save(user);

    await this.redisService.del(this.USERS_WITH_TASKS_CACHE_KEY);

    return toUserResponseDto(saved, { includeTasks: false });
  }

  async findAll() {
    const cached = await this.redisService.getJson<UserResponseDto[]>(
      this.USERS_WITH_TASKS_CACHE_KEY,
    );
    if (cached) return cached;

    const users = await this.userRepo.find({
      relations: ['tasks'],
      order: { id: 'ASC' },
    });

    const dto = users.map((u) => toUserResponseDto(u, { includeTasks: true }));

    await this.redisService.setJson(
      this.USERS_WITH_TASKS_CACHE_KEY,
      dto,
      this.USERS_WITH_TASKS_TTL_SECONDS,
    );

    return dto;
  }

  async createTaskForUser(userId: number, dto: CreateTaskDto) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const task = await this.tasksService.createForUser(user, dto);

    await this.redisService.del(this.USERS_WITH_TASKS_CACHE_KEY);

    return toTaskResponseDto(task);
  }

  async updateSettings(id: number, dto: UpdateUserSettingsDto) {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    user.settings = { ...(user.settings ?? {}), ...dto };
    const saved = await this.userRepo.save(user);

    await this.redisService.del(this.USERS_WITH_TASKS_CACHE_KEY);

    return toUserResponseDto(saved, { includeTasks: false });
  }
}
