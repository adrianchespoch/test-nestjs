import { ValueObject } from '../../../../shared/domain/value-object';
import { randomUUID } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserId extends ValueObject<{ value: string }> {
  static generate(): UserId {
    return new UserId({ value: randomUUID() });
  }

  static fromString(raw: string): UserId {
    if (!UUID_RE.test(raw)) throw new Error(`Invalid UserId: ${raw}`);
    return new UserId({ value: raw });
  }

  get value(): string {
    return this.props.value;
  }
}
