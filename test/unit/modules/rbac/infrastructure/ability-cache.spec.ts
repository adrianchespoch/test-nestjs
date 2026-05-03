import { AbilityCacheStore } from '../../../../../src/modules/rbac/infrastructure/casl/ability-cache.store';
import { buildAbility } from '../../../../../src/modules/rbac/infrastructure/casl/app-ability';
import { Permission } from '../../../../../src/modules/rbac/domain/entities/permission';
import { PermissionId } from '../../../../../src/modules/rbac/domain/value-objects/role-id';

const perm = (action: string, subject: string) =>
  Permission.rehydrate({
    id: PermissionId.generate(),
    action,
    subject,
    conditions: null,
    description: null,
  });

const makeAbility = () => buildAbility([perm('manage', 'all')], { user: { id: 'u-1' } });

describe('AbilityCacheStore (no Redis)', () => {
  it('getLocal returns null on miss', () => {
    const store = new AbilityCacheStore(null);
    expect(store.getLocal('u-1')).toBeNull();
  });

  it('setLocal then getLocal hits', () => {
    const store = new AbilityCacheStore(null);
    const ability = makeAbility();
    store.setLocal('u-1', ability);
    expect(store.getLocal('u-1')).toBe(ability);
  });

  it('getLocal returns null after invalidation (gen change)', async () => {
    const store = new AbilityCacheStore(null);
    const ability = makeAbility();
    store.setLocal('u-1', ability);
    expect(store.getLocal('u-1')).toBe(ability);

    await store.publishInvalidation();
    expect(store.getLocal('u-1')).toBeNull();
  });

  it('publishInvalidation increments gen even without Redis', async () => {
    const store = new AbilityCacheStore(null);
    const before = store.gen;
    const next = await store.publishInvalidation();
    expect(next).toBe(before + 1);
    expect(store.gen).toBe(next);
  });

  it('getRemote returns null without Redis', async () => {
    const store = new AbilityCacheStore(null);
    expect(await store.getRemote('u-1')).toBeNull();
  });

  it('setRemote is no-op without Redis', async () => {
    const store = new AbilityCacheStore(null);
    await expect(store.setRemote('u-1', [])).resolves.toBeUndefined();
  });
});

describe('AbilityCacheStore (with mock Redis)', () => {
  // Tipos mínimos del subset que usa el store
  type MockRedis = {
    get: jest.Mock;
    set: jest.Mock;
    incr: jest.Mock;
    publish: jest.Mock;
    subscribe: jest.Mock;
    duplicate: jest.Mock;
    on: jest.Mock;
    quit: jest.Mock;
  };

  const makeRedis = (): MockRedis => {
    const sub: MockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn(),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    const main: MockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(0),
      subscribe: jest.fn(),
      duplicate: jest.fn().mockReturnValue(sub),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    return main;
  };

  it('onModuleInit reads gen and subscribes', async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValueOnce('5');
    const store = new AbilityCacheStore(redis as never);
    await store.onModuleInit();
    expect(store.gen).toBe(5);
    expect(redis.duplicate).toHaveBeenCalled();
  });

  it('publishInvalidation INCRs gen and PUBLISHes new value', async () => {
    const redis = makeRedis();
    redis.incr.mockResolvedValueOnce(7);
    const store = new AbilityCacheStore(redis as never);
    await store.onModuleInit();

    const next = await store.publishInvalidation();
    expect(next).toBe(7);
    expect(store.gen).toBe(7);
    expect(redis.publish).toHaveBeenCalledWith('rbac:abilities:invalidated', '7');
  });

  it('setRemote uses gen-suffixed key with TTL', async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValueOnce('3');
    const store = new AbilityCacheStore(redis as never);
    await store.onModuleInit();

    await store.setRemote('u-1', []);
    expect(redis.set).toHaveBeenCalledWith('rbac:ability:user:u-1:3', '[]', 'EX', 600);
  });

  it('getRemote returns parsed rules from gen-suffixed key', async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValueOnce('2');
    redis.get.mockResolvedValueOnce(JSON.stringify([{ action: 'read', subject: 'Post' }]));
    const store = new AbilityCacheStore(redis as never);
    await store.onModuleInit();

    const rules = await store.getRemote('u-1');
    expect(rules).toEqual([{ action: 'read', subject: 'Post' }]);
    expect(redis.get).toHaveBeenLastCalledWith('rbac:ability:user:u-1:2');
  });

  it('publishInvalidation falls back to local-only on Redis error', async () => {
    const redis = makeRedis();
    redis.incr.mockRejectedValueOnce(new Error('redis down'));
    const store = new AbilityCacheStore(redis as never);
    await store.onModuleInit();
    const ability = makeAbility();
    store.setLocal('u-1', ability);

    const before = store.gen;
    const after = await store.publishInvalidation();
    expect(after).toBe(before + 1);
    expect(store.getLocal('u-1')).toBeNull();
  });
});
