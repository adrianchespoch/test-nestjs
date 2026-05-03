import type { User } from '../entities/user';
import type { Email } from '../value-objects/email';
import type { UserId } from '../value-objects/user-id';

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  emailExists(email: Email): Promise<boolean>;
  save(user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
