import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { AppEnvironment } from '../config/app-environment';

export function createTypeOrmOptions(
  appEnvironment: AppEnvironment,
): TypeOrmModuleOptions & DataSourceOptions {
  return {
    type: 'postgres',
    url: appEnvironment.database.url,
    autoLoadEntities: true,
    synchronize: false,
    logging: appEnvironment.database.logging,
    entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
    migrations: [
      'dist/database/migrations/*.js',
      'src/database/migrations/*.ts',
    ],
    migrationsTableName: 'typeorm_migrations',
    ssl: false,
  };
}
