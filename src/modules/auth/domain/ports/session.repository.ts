import type { Session, SessionId } from '../entities/session';

export interface ISessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  save(session: Session): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('ISessionRepository');
