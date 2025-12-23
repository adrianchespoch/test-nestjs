import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvConfiguration } from './config/app.config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [EnvConfiguration],
      // // Con esto evitamos tener q importar el 'ConfigModule' en c/module q utilize EnvV
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      ssl: process.env.STAGE === 'prod',
      extra: {
        ssl:
          process.env.STAGE === 'prod' ? { rejectUnauthorized: false } : null,
      },

      type: 'mysql',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,

      // db ---------
      autoLoadEntities: true,
      synchronize: false,
      // migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrations: [__dirname + '/migrations/*.js'],
      migrationsRun: false,
    }),

    // redis -----
    RedisModule,

    UsersModule,
    TasksModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
