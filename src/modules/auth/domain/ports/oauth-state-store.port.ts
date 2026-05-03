/**
 * Persistencia efímera del state CSRF + intent del flow OAuth.
 * El state se valida y consume en el callback (single-use).
 *
 * `linkUserId` se setea cuando el flow se inició desde un user autenticado
 * que quiere vincular su cuenta — útil para distinguir "linking" de "new login".
 */
export interface OAuthStatePayload {
  provider: 'google' | 'github';
  linkUserId: string | null;
  redirectAfter?: string | null;
}

export interface IOAuthStateStore {
  /** Genera state aleatorio + persiste payload con TTL corto (10 min default). */
  issue(payload: OAuthStatePayload): Promise<string>;
  /** Consume state — retorna payload si era válido y lo elimina, null si no existe. */
  consume(state: string): Promise<OAuthStatePayload | null>;
}

export const OAUTH_STATE_STORE = Symbol('IOAuthStateStore');
