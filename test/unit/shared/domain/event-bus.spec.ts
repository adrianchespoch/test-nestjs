import { InMemoryEventBus } from '../../../../src/shared/infrastructure/event-bus/in-memory-event-bus';
import type { DomainEvent } from '../../../../src/shared/domain/domain-event';

const ev = (name: string, aggregateId = 'ag-1'): DomainEvent => ({
  name,
  occurredAt: new Date(),
  aggregateId,
  payload: {},
});

describe('InMemoryEventBus', () => {
  it('routes events to subscribed handlers', async () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('user.registered', () => {
      calls.push('a');
    });
    bus.subscribe('user.registered', async () => {
      calls.push('b');
    });

    await bus.publish([ev('user.registered')]);
    expect(calls).toEqual(['a', 'b']);
  });

  it('ignores events without subscribers', async () => {
    const bus = new InMemoryEventBus();
    await expect(bus.publish([ev('nobody.cares')])).resolves.toBeUndefined();
  });

  it('continues delivery if a handler throws', async () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('user.registered', () => {
      calls.push('first');
      throw new Error('boom');
    });
    bus.subscribe('user.registered', () => {
      calls.push('second');
    });

    await bus.publish([ev('user.registered')]);
    expect(calls).toEqual(['first', 'second']);
  });
});
