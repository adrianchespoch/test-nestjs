import { buildAbility } from '../../../../../src/modules/rbac/infrastructure/casl/app-ability';
import { Permission } from '../../../../../src/modules/rbac/domain/entities/permission';
import { PermissionId } from '../../../../../src/modules/rbac/domain/value-objects/role-id';

const perm = (action: string, subject: string, conditions?: Record<string, unknown>) =>
  Permission.rehydrate({
    id: PermissionId.generate(),
    action,
    subject,
    conditions: conditions ?? null,
    description: null,
  });

const USER_ID = 'user-123';

describe('buildAbility', () => {
  it('grants nothing for empty permission set', () => {
    const ability = buildAbility([], { user: { id: USER_ID } });
    expect(ability.can('read', 'Post')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('manage:all is wildcard', () => {
    const ability = buildAbility([perm('manage', 'all')], { user: { id: USER_ID } });
    expect(ability.can('read', 'Post')).toBe(true);
    expect(ability.can('delete', 'AnythingElse')).toBe(true);
  });

  it('action specific: only matching action+subject', () => {
    const ability = buildAbility([perm('read', 'Post')], { user: { id: USER_ID } });
    expect(ability.can('read', 'Post')).toBe(true);
    expect(ability.can('update', 'Post')).toBe(false);
    expect(ability.can('read', 'User')).toBe(false);
  });

  it('ABAC condition: $user.id placeholder is resolved against context', () => {
    const ability = buildAbility([perm('update', 'Post', { ownerId: '$user.id' })], {
      user: { id: USER_ID },
    });
    // CASL evalúa la condición contra el recurso pasado:
    expect(ability.can('update', { ownerId: USER_ID } as never)).toBe(false); // missing __caslSubjectType__
    // Forma correcta con subject() helper sería más realista; aquí validamos el extracto
    // del rule:
    const rules = ability.rules as Array<{
      action: string;
      subject: string;
      conditions?: Record<string, unknown>;
    }>;
    expect(rules).toHaveLength(1);
    expect(rules[0]!.action).toBe('update');
    expect(rules[0]!.conditions).toEqual({ ownerId: USER_ID });
  });

  it('multiple permissions accumulate', () => {
    const ability = buildAbility(
      [perm('read', 'User'), perm('read', 'Role'), perm('read', 'Permission')],
      { user: { id: USER_ID } },
    );
    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('read', 'Role')).toBe(true);
    expect(ability.can('read', 'Permission')).toBe(true);
    expect(ability.can('write', 'User')).toBe(false);
  });

  it('unlock:User does not imply manage:User', () => {
    const ability = buildAbility([perm('unlock', 'User')], { user: { id: USER_ID } });
    expect(ability.can('unlock', 'User')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(false);
    expect(ability.can('manage', 'User')).toBe(false);
  });
});
