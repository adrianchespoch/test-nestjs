import { TaskResponseDto } from '../tasks/dto/task-response.dto';
import { Task } from '../tasks/entities/task.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

export function toTaskResponseDto(task: Task): TaskResponseDto {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed,
    createdAt: task.createdAt,
    userId: task.userId,
  };
}

export function toUserResponseDto(
  user: User,
  opts?: { includeTasks?: boolean },
): UserResponseDto {
  const includeTasks = opts?.includeTasks ?? false;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    settings: user.settings ?? null,
    createdAt: user.createdAt,
    tasks: includeTasks ? (user.tasks ?? []).map(toTaskResponseDto) : [],
  };
}
