import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppEnvironment } from '../config/app-environment';
import { createTypeOrmOptions } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createTypeOrmOptions({
          app: {
            name: configService.getOrThrow<string>('app.name'),
            env: configService.getOrThrow<AppEnvironment['app']['env']>(
              'app.env',
            ),
            host: configService.getOrThrow<string>('app.host'),
            port: configService.getOrThrow<number>('app.port'),
            baseUrl: configService.getOrThrow<string>('app.baseUrl'),
          },
          database: {
            url: configService.getOrThrow<string>('database.url'),
            logging: configService.get<boolean>('database.logging') ?? false,
          },
          betterAuth: {
            basePath: configService.getOrThrow<string>('betterAuth.basePath'),
            cookieName: configService.getOrThrow<string>(
              'betterAuth.cookieName',
            ),
          },
        }),
    }),
  ],
})
export class DatabaseModule {}
