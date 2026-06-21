import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';
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
    AppConfigModule,
    DatabaseModule,
    BetterAuthModule,
    HealthModule,
    IdentityModule,
    AuthenticationModule,
    OidcModule,
    ClientsModule,
    TokensModule,
    AdminModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SecurityHeadersMiddleware, RequestContextMiddleware)
      .forRoutes('*');
  }
}
