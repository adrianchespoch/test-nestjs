# 01 — Prisma setup

## Schema layout

`prisma/schema.prisma` es la fuente de verdad del modelo de datos.

```prisma
// prisma/schema.prisma
generator client {
  provider     = "prisma-client-js"
  moduleFormat = "cjs"               // necesario hasta NestJS 12 (ESM-first)
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgcrypto]            // para gen_random_uuid en defaults si se usa
}

// ---- Auth ----

model User {
  id              String   @id @default(uuid()) @db.Uuid
  email           String   @unique @db.VarChar(254)
  name            String   @db.VarChar(120)
  passwordHash    String?  @db.VarChar(255)        // null si solo OAuth
  emailVerifiedAt DateTime?
  failedLoginAttempts Int @default(0)
  lockedUntil     DateTime?
  isActive        Boolean  @default(true)
  deletedAt       DateTime?
  mustChangePassword Boolean @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  roles           UserRole[]
  sessions        Session[]
  refreshTokens   RefreshToken[]
  accounts        AccountProvider[]

  @@index([email])
  @@index([deletedAt])
}

model AccountProvider {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @db.Uuid
  provider          String   @db.VarChar(40)        // 'google' | 'github'
  providerAccountId String   @db.VarChar(255)
  accessTokenEncrypted String?
  refreshTokenEncrypted String?
  createdAt         DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  userAgent String?  @db.VarChar(512)
  ip        String?  @db.VarChar(45)
  createdAt DateTime @default(now())
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokens RefreshToken[]

  @@index([userId, revokedAt])
}

model RefreshToken {
  id          String   @id @default(uuid()) @db.Uuid
  hash        String   @unique @db.VarChar(255)    // sha-256 del token, no el token raw
  familyId    String   @db.Uuid                      // rotación: misma familia comparte ancestro
  parentId    String?  @db.Uuid                      // chain
  sessionId   String   @db.Uuid
  userId      String   @db.Uuid
  expiresAt   DateTime
  revokedAt   DateTime?
  reuseDetectedAt DateTime?
  createdAt   DateTime @default(now())

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([familyId])
  @@index([userId, revokedAt])
}

// ---- RBAC ----

model Role {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(60)
  description String?  @db.VarChar(255)
  isSystem    Boolean  @default(false)              // 'superadmin' = true; protegido
  createdAt   DateTime @default(now())

  users       UserRole[]
  permissions RolePermission[]
}

model Permission {
  id          String   @id @default(uuid()) @db.Uuid
  action      String   @db.VarChar(40)              // 'read' | 'create' | ...
  subject     String   @db.VarChar(60)              // 'Post' | 'User' | 'all'
  conditions  Json?                                  // CASL conditions (ej. { ownerId: '$user.id' })
  description String?  @db.VarChar(255)

  roles RolePermission[]

  @@unique([action, subject])
}

model RolePermission {
  roleId       String @db.Uuid
  permissionId String @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

model UserRole {
  userId String @db.Uuid
  roleId String @db.Uuid

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Restrict)

  @@id([userId, roleId])
  @@index([roleId])
}

// ---- Auth tokens (reset, verify) ----

model OneTimeToken {
  id        String   @id @default(uuid()) @db.Uuid
  hash      String   @unique @db.VarChar(255)
  purpose   String   @db.VarChar(40)                  // 'password-reset' | 'email-verify'
  userId    String   @db.Uuid
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purpose])
}
```

(Modelo no exhaustivo — el equipo extiende según los bounded contexts del proyecto concreto.)

## PrismaService

```ts
// src/shared/infrastructure/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService, logger: PinoLogger) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      datasources: { db: { url: config.get('DATABASE_URL') } },
    });

    this.$on('query', (e) =>
      logger.debug({ q: e.query, params: e.params, ms: e.duration }, 'prisma.query'),
    );
    this.$on('error', (e) => logger.error({ err: e }, 'prisma.error'));
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Helper para tests: trunca todas las tablas en orden seguro */
  async truncateAllForTests() {
    if (process.env.NODE_ENV !== 'test') throw new Error('truncateAllForTests is test-only');
    const tables = await this.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations'`;
    await this.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
}
```

## PrismaModule

```ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

## Generación del cliente

```jsonc
// package.json scripts
{
  "postinstall": "prisma generate",
  "prisma:generate": "prisma generate",
  "db:migrate:dev": "prisma migrate dev",
  "db:migrate:deploy": "prisma migrate deploy",
  "db:reset": "prisma migrate reset --force",
  "db:seed": "prisma db seed",
}
```

Husky `post-merge`:

```sh
# .husky/post-merge
if git diff --name-only HEAD~1 HEAD | grep -q "prisma/schema.prisma"; then
  echo "schema.prisma changed → regenerating client"
  pnpm prisma generate
fi
```

## Datasource URL

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname?schema=public&connection_limit=10&pool_timeout=10
```

- `connection_limit`: ajustar por tamaño del pod. Default Prisma calcula en función de cores; para apps Nest típicas 10–25.
- `pool_timeout`: 10s para fallar rápido si el pool está saturado.
- En prod usar PgBouncer (transaction mode) entre app y Postgres si hay alta concurrencia.

## Naming conventions

- **Modelos**: PascalCase singular (`User`, no `Users`).
- **Tablas físicas**: `@@map` solo si necesitamos snake_case (no por defecto).
- **Campos**: camelCase en Prisma → `@map("snake_case")` si la tabla viene con esa convención.
- **IDs**: UUID v4 (`@db.Uuid`) salvo necesidad explícita de `bigint` ordinal.
- **Soft delete**: `deletedAt DateTime?`. Listings filtran por defecto `deletedAt IS NULL`.

## $extends para multi-tenancy futura (no incluido en v1)

Si en el futuro se necesita tenant isolation, Prisma 7 soporta `$extends` con un middleware que inyecta `WHERE tenantId = $current` automáticamente. Aplicable sin cambiar el schema.
