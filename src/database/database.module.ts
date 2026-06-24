import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfigService } from '../config/app-config.service';
import { createTypeOrmOptions } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) =>
        createTypeOrmOptions({
          app: {
            name: configService.get('app.name'),
            env: configService.get('app.env'),
            host: configService.get('app.host'),
            port: configService.get('app.port'),
            baseUrl: configService.get('app.baseUrl'),
          },
          database: {
            url: configService.get('database.url'),
            logging: configService.get('database.logging'),
          },
          betterAuth: {
            basePath: configService.get('betterAuth.basePath'),
            cookieName: configService.get('betterAuth.cookieName'),
            secret: configService.get('betterAuth.secret'),
            loginPath: configService.get('betterAuth.loginPath'),
            consentPath: configService.get('betterAuth.consentPath'),
          },
          authentication: {
            csrfCookieName: configService.get('authentication.csrfCookieName'),
            providerSessionCookieName: configService.get(
              'authentication.providerSessionCookieName',
            ),
            providerSessionIdleTtlSeconds: configService.get(
              'authentication.providerSessionIdleTtlSeconds',
            ),
            providerSessionAbsoluteTtlSeconds: configService.get(
              'authentication.providerSessionAbsoluteTtlSeconds',
            ),
            adminRecentAuthWindowSeconds: configService.get(
              'authentication.adminRecentAuthWindowSeconds',
            ),
            loginRateLimitWindowSeconds: configService.get(
              'authentication.loginRateLimitWindowSeconds',
            ),
            loginRateLimitIpMaxAttempts: configService.get(
              'authentication.loginRateLimitIpMaxAttempts',
            ),
            loginRateLimitAccountMaxAttempts: configService.get(
              'authentication.loginRateLimitAccountMaxAttempts',
            ),
            tokenRateLimitWindowSeconds: configService.get(
              'authentication.tokenRateLimitWindowSeconds',
            ),
            tokenRateLimitIpMaxAttempts: configService.get(
              'authentication.tokenRateLimitIpMaxAttempts',
            ),
          },
          bootstrap: {
            adminEmail: configService.get('bootstrap.adminEmail'),
            adminDisplayName: configService.get('bootstrap.adminDisplayName'),
            adminGivenName: configService.get('bootstrap.adminGivenName'),
            adminFamilyName: configService.get('bootstrap.adminFamilyName'),
            adminUsername: configService.get('bootstrap.adminUsername'),
            adminPassword: configService.get('bootstrap.adminPassword'),
            adminGroupSlug: configService.get('bootstrap.adminGroupSlug'),
            adminGroupName: configService.get('bootstrap.adminGroupName'),
            clientId: configService.get('bootstrap.clientId'),
            clientName: configService.get('bootstrap.clientName'),
            clientSecret: configService.get('bootstrap.clientSecret'),
            clientRedirectUri: configService.get('bootstrap.clientRedirectUri'),
            clientPostLogoutRedirectUri: configService.get(
              'bootstrap.clientPostLogoutRedirectUri',
            ),
          },
        }),
    }),
  ],
})
export class DatabaseModule {}
