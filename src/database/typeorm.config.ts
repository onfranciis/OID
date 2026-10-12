import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { AppEnvironment } from '../config/app-environment';
import { DATABASE_ENTITIES } from './entities';
import { DATABASE_MIGRATIONS } from './migrations';

export function createTypeOrmOptions(
  appEnvironment: AppEnvironment,
): TypeOrmModuleOptions & DataSourceOptions {
  return {
    type: 'postgres',
    url: appEnvironment.database.url,
    autoLoadEntities: true,
    synchronize: false,
    logging: appEnvironment.database.logging,
    entities: [...DATABASE_ENTITIES],
    migrations: [...DATABASE_MIGRATIONS],
    migrationsTableName: 'typeorm_migrations',
    ssl: false,
    extra: {
      max: appEnvironment.database.poolMax,
      connectionTimeoutMillis: appEnvironment.database.connectTimeoutMs,
    },
    retryAttempts: appEnvironment.database.retryAttempts,
    retryDelay: appEnvironment.database.retryDelayMs,
  };
}
