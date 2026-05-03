/**
 * IClock — abstracción del tiempo. Inyectada en use cases que dependen de "now"
 * para que tests puedan congelarlo.
 */
export interface IClock {
  now(): Date;
}

export const CLOCK = Symbol('IClock');
