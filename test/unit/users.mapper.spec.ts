import {
  toTaskResponseDto,
  toUserResponseDto,
} from '../../src/users/users.mapper';

describe('UsersMapper (unit)', () => {
  it('toTaskResponseDto() should not include user', () => {
    const task: any = {
      id: 10,
      title: 'X',
      completed: true,
      createdAt: new Date('2025-12-23T15:10:00.000Z'),
      userId: 1,
      user: { id: 1, name: 'Hidden' },
    };

    const dto = toTaskResponseDto(task);

    expect(dto).toEqual({
      id: 10,
      title: 'X',
      completed: true,
      createdAt: task.createdAt,
      userId: 1,
    });
    expect((dto as any).user).toBeUndefined();
  });

  it('toUserResponseDto() should return tasks=[] when includeTasks=false', () => {
    const user: any = {
      id: 1,
      name: 'A',
      email: 'a@test.com',
      isActive: true,
      settings: null,
      createdAt: new Date('2025-12-23T15:00:00.000Z'),
      tasks: [{ id: 10 }],
    };

    const dto = toUserResponseDto(user, { includeTasks: false });

    expect(dto.tasks).toEqual([]);
  });

  it('toUserResponseDto() should map tasks when includeTasks=true', () => {
    const user: any = {
      id: 1,
      name: 'A',
      email: 'a@test.com',
      isActive: true,
      settings: { theme: 'dark' },
      createdAt: new Date('2025-12-23T15:00:00.000Z'),
      tasks: [
        {
          id: 10,
          title: 'T1',
          completed: false,
          createdAt: new Date('2025-12-23T15:10:00.000Z'),
          userId: 1,
        },
      ],
    };

    const dto = toUserResponseDto(user, { includeTasks: true });

    expect(dto.tasks).toHaveLength(1);
    expect(dto.tasks[0]).toMatchObject({
      id: 10,
      title: 'T1',
      completed: false,
      userId: 1,
    });
  });
});
