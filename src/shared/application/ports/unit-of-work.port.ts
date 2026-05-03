/**
 * IUnitOfWork — agrupa operaciones de varios repositorios en una transacción atómica.
 *
 * El callback recibe un contexto opaco que el adapter (ej. PrismaUnitOfWork)
 * traduce a la transacción nativa del ORM.
 */
export interface IUnitOfWork {
  execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>;
}

/** Marker type — los repos lo aceptan opcionalmente para asociarse a la transacción activa. */
export interface UnitOfWorkContext {
  readonly _brand: 'uow-context';
}

export const UNIT_OF_WORK = Symbol('IUnitOfWork');
