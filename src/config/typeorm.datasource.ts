import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,

  entities: [User, Task],
  // migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*.js'],

  synchronize: false,

  ssl: process.env.STAGE === 'prod',
  extra:
    process.env.STAGE === 'prod'
      ? { ssl: { rejectUnauthorized: false } }
      : undefined,
});
