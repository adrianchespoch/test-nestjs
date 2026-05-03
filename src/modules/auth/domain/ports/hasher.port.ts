import type { HashedPassword, Password } from '../value-objects/password';

export interface IHasher {
  hash(plain: Password): Promise<HashedPassword>;
  /** Constant-time. Recibe el hash almacenado y el plaintext del intento. */
  verify(stored: HashedPassword, attempt: string): Promise<boolean>;
}

export const HASHER = Symbol('IHasher');
