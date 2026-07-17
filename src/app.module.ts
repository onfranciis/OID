import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { adminStaticOptions } from './admin/admin-static.options';
import { AppConfigModule } from './config/app-config.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';
import { StructuredLoggerMiddleware } from './common/structured-logger.middleware';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { MetricsModule } from './metrics/metrics.module';
import { IdentityModule } from './identity/identity.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { OidcModule } from './oidc/oidc.module';
import { ClientsModule } from './clients/clients.module';
import { TokensModule } from './tokens/tokens.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { BetterAuthModule } from './better-auth/better-auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ServeStaticModule.forRoot(adminStaticOptions()),
    AppConfigModule,
    DatabaseModule,
    BetterAuthModule,
    HealthModule,
    MetricsModule,
    IdentityModule,
    AuthenticationModule,
    OidcModule,
    ClientsModule,
    TokensModule,
    AdminModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        SecurityHeadersMiddleware,
        RequestContextMiddleware,
        StructuredLoggerMiddleware,
        MetricsMiddleware,
      )
      .forRoutes('*');
  }
}
