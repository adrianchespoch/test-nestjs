import { AggregateRoot } from '../../../../src/shared/domain/aggregate-root';
import { BaseDomainEvent } from '../../../../src/shared/domain/domain-event';
import { ValueObject } from '../../../../src/shared/domain/value-object';

class TestId extends ValueObject<{ value: string }> {
  static of(v: string): TestId {
    return new TestId({ value: v });
  }
}

class WidgetCreated extends BaseDomainEvent {
  readonly name = 'widget.created';
  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<{ name: string }>,
  ) {
    super();
  }
}

class Widget extends AggregateRoot<TestId> {
  private constructor(id: TestId) {
    super(id);
  }
  static create(id: string, name: string): Widget {
    const w = new Widget(TestId.of(id));
    w.addEvent(new WidgetCreated(id, { name }));
    return w;
  }

  triggerEvent(name: string): void {
    this.addEvent(new WidgetCreated(this.id['props'].value, { name }));
  }
}

describe('AggregateRoot', () => {
  it('accumulates events and pulls them once', () => {
    const w = Widget.create('w-1', 'first');
    expect(w.pendingEvents).toHaveLength(1);

    const events = w.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe('widget.created');

    expect(w.pendingEvents).toHaveLength(0);
    expect(w.pullEvents()).toEqual([]);
  });

  it('keeps adding events after pull', () => {
    const w = Widget.create('w-1', 'first');
    w.pullEvents();
    w.triggerEvent('second');
    w.triggerEvent('third');
    const events = w.pullEvents();
    expect(events).toHaveLength(2);
  });

  it('equality by id', () => {
    const a = Widget.create('w-1', 'a');
    const b = Widget.create('w-1', 'b');
    const c = Widget.create('w-2', 'c');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
