/**
 * Result<T, E> — éxito o error como valor, sin throw.
 *
 * Uso:
 *   const r = Email.create('foo@bar.com');
 *   if (r.isErr()) return Result.err(r.error);
 *   doSomething(r.value);
 */

export interface Ok<T> {
  readonly kind: 'ok';
  readonly value: T;
  isOk(): this is Ok<T>;
  isErr(): false;
}

export interface Err<E> {
  readonly kind: 'err';
  readonly error: E;
  isOk(): false;
  isErr(): this is Err<E>;
}

export type Result<T, E = Error> = Ok<T> | Err<E>;

const ok = <T>(value: T): Ok<T> => ({
  kind: 'ok',
  value,
  isOk(): this is Ok<T> {
    return true;
  },
  isErr(): false {
    return false;
  },
});

const err = <E>(error: E): Err<E> => ({
  kind: 'err',
  error,
  isOk(): false {
    return false;
  },
  isErr(): this is Err<E> {
    return true;
  },
});

/** Combina varios Results: si todos OK retorna `Ok([values...])`; si alguno Err retorna el primer Err. */
function all<T, E>(results: Array<Result<T, E>>): Result<T[], E> {
  const values: T[] = [];
  for (const r of results) {
    if (r.isErr()) return r;
    values.push(r.value);
  }
  return ok(values);
}

/** Convierte una promesa potencialmente fallida en `Result`. */
async function fromPromise<T, E = Error>(
  p: Promise<T>,
  mapError: (err: unknown) => E = (e) => e as E,
): Promise<Result<T, E>> {
  try {
    return ok(await p);
  } catch (e) {
    return err(mapError(e));
  }
}

export const Result = { ok, err, all, fromPromise } as const;
