import { Permission } from '../../../../../src/modules/rbac/domain/entities/permission';
import { Role } from '../../../../../src/modules/rbac/domain/entities/role';
import { PermissionId } from '../../../../../src/modules/rbac/domain/value-objects/role-id';

const NOW = new Date('2026-05-03T10:00:00Z');

const perm = (action: string, subject: string) =>
  Permission.rehydrate({
    id: PermissionId.generate(),
    action,
    subject,
    conditions: null,
    description: null,
  });

describe('Role aggregate', () => {
  it('creates with valid name + permissions', () => {
    const r = Role.create({
      name: 'editor',
      description: 'edits content',
      isSystem: false,
      now: NOW,
      permissions: [perm('read', 'Post'), perm('update', 'Post')],
    });
    expect(r.name).toBe('editor');
    expect(r.permissions).toHaveLength(2);
    expect(r.isSystem).toBe(false);
  });

  it('rejects invalid name format', () => {
    expect(() =>
      Role.create({ name: 'BadName!', description: null, isSystem: false, now: NOW }),
    ).toThrow();
    expect(() =>
      Role.create({ name: 'a', description: null, isSystem: false, now: NOW }),
    ).toThrow();
    expect(() =>
      Role.create({ name: '1starts-with-digit', description: null, isSystem: false, now: NOW }),
    ).toThrow();
  });

  it('replacePermissions updates set and emits event', () => {
    const r = Role.create({
      name: 'editor',
      description: null,
      isSystem: false,
      now: NOW,
      permissions: [perm('read', 'Post')],
    });
    r.pullEvents();

    r.replacePermissions([perm('read', 'Post'), perm('update', 'Post')]);
    expect(r.permissions).toHaveLength(2);
    const events = r.pullEvents();
    expect(events.map((e) => e.name)).toEqual(['rbac.role.permissions_changed']);
  });

  it('replacePermissions is no-op when set unchanged', () => {
    const ps = [perm('read', 'Post'), perm('update', 'Post')];
    const r = Role.create({
      name: 'editor',
      description: null,
      isSystem: false,
      now: NOW,
      permissions: ps,
    });
    r.pullEvents();
    r.replacePermissions([ps[1]!, ps[0]!]); // mismo set, distinto orden
    expect(r.pullEvents()).toEqual([]);
  });

  it('system role rejects modifications', () => {
    const r = Role.create({
      name: 'superadmin',
      description: null,
      isSystem: true,
      now: NOW,
      permissions: [perm('manage', 'all')],
    });
    expect(() => r.replacePermissions([perm('read', 'User')])).toThrow();
  });
});
