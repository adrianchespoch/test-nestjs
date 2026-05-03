import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_PERMISSIONS: Array<{
  action: string;
  subject: string;
  description?: string;
  conditions?: Prisma.InputJsonValue;
}> = [
  { action: 'manage', subject: 'all', description: 'Full access (superadmin)' },
  { action: 'create', subject: 'User' },
  { action: 'read', subject: 'User' },
  { action: 'update', subject: 'User' },
  { action: 'delete', subject: 'User' },
  { action: 'unlock', subject: 'User' },
  { action: 'create', subject: 'Role' },
  { action: 'read', subject: 'Role' },
  { action: 'update', subject: 'Role' },
  { action: 'delete', subject: 'Role' },
  { action: 'read', subject: 'Permission' },
];

const SYSTEM_ROLES: Array<{ name: string; isSystem: boolean; permissions: string[] }> = [
  { name: 'superadmin', isSystem: true, permissions: ['manage:all'] },
  {
    name: 'admin',
    isSystem: false,
    permissions: [
      'create:User',
      'read:User',
      'update:User',
      'delete:User',
      'unlock:User',
      'create:Role',
      'read:Role',
      'update:Role',
      'delete:Role',
      'read:Permission',
    ],
  },
  { name: 'user', isSystem: false, permissions: ['read:User'] },
];

async function seedPermissions() {
  for (const p of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action_subject: { action: p.action, subject: p.subject } },
      update: { description: p.description ?? null },
      create: {
        action: p.action,
        subject: p.subject,
        description: p.description ?? null,
        conditions: p.conditions ?? Prisma.DbNull,
      },
    });
  }
}

async function seedRoles() {
  for (const r of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { isSystem: r.isSystem },
      create: { name: r.name, isSystem: r.isSystem },
    });

    for (const key of r.permissions) {
      const [action, subject] = key.split(':');
      if (!action || !subject) continue;
      const perm = await prisma.permission.findUnique({
        where: { action_subject: { action, subject } },
      });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }
}

async function main() {
  console.log('Seeding system permissions and roles...');
  await seedPermissions();
  await seedRoles();

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
