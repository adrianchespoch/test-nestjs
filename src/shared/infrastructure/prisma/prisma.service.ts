import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7: el `url` no vive en schema.prisma (ver prisma.config.ts) y el
    // cliente generado ya no acepta `datasources`/`datasourceUrl` — la conexión
    // se inyecta vía driver adapter. Joi garantiza DATABASE_URL al boot.
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Test-only helper. Truncates all tables; refuses to run outside NODE_ENV=test. */
  async truncateAllForTests(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('truncateAllForTests is only allowed when NODE_ENV=test');
    }
    const rows = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `;
    if (rows.length === 0) return;
    const list = rows.map((r) => `"${r.tablename}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }
}
