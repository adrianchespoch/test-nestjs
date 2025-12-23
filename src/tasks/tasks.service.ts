import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { Task } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  async createForUser(user: User, dto: CreateTaskDto) {
    const task = this.taskRepo.create({
      title: dto.title,
      completed: dto.completed ?? false,
      user,
    });

    return this.taskRepo.save(task);
  }
}
