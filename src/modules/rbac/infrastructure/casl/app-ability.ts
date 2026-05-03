import {
  type MongoAbility,
  createMongoAbility,
  AbilityBuilder,
  type RawRuleOf,
} from '@casl/ability';
import type { Permission } from '../../domain/entities/permission';

export type AppAction = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'unlock' | 'list';
export type AppSubject = 'all' | 'User' | 'Role' | 'Permission' | string;
export type AppAbility = MongoAbility<[AppAction | string, AppSubject]>;

/**
 * Construye un AppAbility a partir de una lista de permissions del dominio.
 * Conditions de CASL aceptan placeholders como `{ ownerId: '$user.id' }`;
 * los resolvemos con un map provisto por el caller.
 */
export function buildAbility(
  permissions: readonly Permission[],
  context: Readonly<{ user: { id: string } }>,
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  for (const p of permissions) {
    const resolved = resolveConditions(p.conditions, context);
    if (resolved) {
      // CASL acepta MongoQuery; nuestro shape es compatible en tiempo de ejecución.
      can(p.action as AppAction, p.subject, resolved as never);
    } else {
      can(p.action as AppAction, p.subject);
    }
  }
  return build();
}

function resolveConditions(
  raw: Readonly<Record<string, unknown>> | null,
  context: Readonly<{ user: { id: string } }>,
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.startsWith('$')) {
      out[k] = resolvePlaceholder(v, context);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = resolveConditions(v as Record<string, unknown>, context);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function resolvePlaceholder(token: string, context: { user: { id: string } }): unknown {
  switch (token) {
    case '$user.id':
      return context.user.id;
    default:
      return token;
  }
}

/** Útil para construir reglas a mano en tests. */
export type AppAbilityRule = RawRuleOf<AppAbility>;
