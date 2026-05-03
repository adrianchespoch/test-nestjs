import { Result } from '../../../../src/shared/domain/result';

describe('Result', () => {
  describe('ok', () => {
    it('isOk() narrows to Ok', () => {
      const r = Result.ok(42);
      expect(r.isOk()).toBe(true);
      expect(r.isErr()).toBe(false);
      if (r.isOk()) expect(r.value).toBe(42);
    });
  });

  describe('err', () => {
    it('isErr() narrows to Err', () => {
      const r = Result.err(new Error('bad'));
      expect(r.isErr()).toBe(true);
      expect(r.isOk()).toBe(false);
      if (r.isErr()) expect(r.error.message).toBe('bad');
    });
  });

  describe('all', () => {
    it('returns Ok with all values when none fail', () => {
      const r = Result.all([Result.ok(1), Result.ok(2), Result.ok(3)]);
      expect(r.isOk()).toBe(true);
      if (r.isOk()) expect(r.value).toEqual([1, 2, 3]);
    });

    it('returns the first Err when any fails', () => {
      const r = Result.all<number, string>([Result.ok(1), Result.err('boom'), Result.ok(3)]);
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error).toBe('boom');
    });

    it('returns Ok([]) for empty input', () => {
      const r = Result.all<number, Error>([]);
      expect(r.isOk()).toBe(true);
      if (r.isOk()) expect(r.value).toEqual([]);
    });
  });

  describe('fromPromise', () => {
    it('captures resolved value as Ok', async () => {
      const r = await Result.fromPromise(Promise.resolve(42));
      expect(r.isOk()).toBe(true);
      if (r.isOk()) expect(r.value).toBe(42);
    });

    it('captures rejection as Err with default mapper', async () => {
      const boom = new Error('boom');
      const r = await Result.fromPromise(Promise.reject(boom));
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error).toBe(boom);
    });

    it('applies custom error mapper', async () => {
      const r = await Result.fromPromise(
        Promise.reject(new Error('boom')),
        (e) => `mapped:${(e as Error).message}`,
      );
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error).toBe('mapped:boom');
    });
  });
});
