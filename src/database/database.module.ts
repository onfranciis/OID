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
          bootstrap: {
            adminEmail: configService.getOrThrow<string>(
              'bootstrap.adminEmail',
            ),
            adminDisplayName: configService.getOrThrow<string>(
              'bootstrap.adminDisplayName',
            ),
            adminGivenName:
              configService.get<string>('bootstrap.adminGivenName') ?? null,
            adminFamilyName:
              configService.get<string>('bootstrap.adminFamilyName') ?? null,
            adminUsername:
              configService.get<string>('bootstrap.adminUsername') ?? null,
            adminGroupSlug: configService.getOrThrow<string>(
              'bootstrap.adminGroupSlug',
            ),
            adminGroupName: configService.getOrThrow<string>(
              'bootstrap.adminGroupName',
            ),
            clientId: configService.getOrThrow<string>('bootstrap.clientId'),
            clientName: configService.getOrThrow<string>(
              'bootstrap.clientName',
            ),
            clientRedirectUri: configService.getOrThrow<string>(
              'bootstrap.clientRedirectUri',
            ),
            clientPostLogoutRedirectUri: configService.getOrThrow<string>(
              'bootstrap.clientPostLogoutRedirectUri',
            ),
          },
        }),
    }),
  ],
})
export class DatabaseModule {}
