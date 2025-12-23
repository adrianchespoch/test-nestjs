import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Task } from '../../src/tasks/entities/task.entity';
import { TasksService } from '../../src/tasks/tasks.service';

describe('TasksService (unit)', () => {
  let service: TasksService;

  let taskRepo: jest.Mocked<Partial<Repository<Task>>>;

  beforeEach(async () => {
    taskRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
      ],
    }).compile();

    service = module.get(TasksService);
  });

  it('createForUser() should create + save task with defaults', async () => {
    const user = { id: 1 } as any;

    const createdEntity = {
      id: 10,
      title: 'T1',
      completed: false,
      userId: 1,
      user,
      createdAt: new Date('2025-12-23T15:10:00.000Z'),
    } as any;

    (taskRepo.create as jest.Mock).mockReturnValue(createdEntity);
    (taskRepo.save as jest.Mock).mockResolvedValue(createdEntity);

    const res = await service.createForUser(user, { title: 'T1' } as any);

    expect(taskRepo.create).toHaveBeenCalledWith({
      title: 'T1',
      completed: false,
      user,
    });
    expect(taskRepo.save).toHaveBeenCalledWith(createdEntity);
    expect(res.id).toBe(10);
    expect(res.completed).toBe(false);
  });

  it('createForUser() should respect completed if provided', async () => {
    const user = { id: 1 } as any;

    const createdEntity = {
      id: 11,
      title: 'T2',
      completed: true,
      userId: 1,
      user,
      createdAt: new Date(),
    } as any;

    (taskRepo.create as jest.Mock).mockReturnValue(createdEntity);
    (taskRepo.save as jest.Mock).mockResolvedValue(createdEntity);

    const res = await service.createForUser(user, {
      title: 'T2',
      completed: true,
    } as any);

    expect(taskRepo.create).toHaveBeenCalledWith({
      title: 'T2',
      completed: true,
      user,
    });
    expect(res.completed).toBe(true);
  });
});
