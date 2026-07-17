import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AppConfigModule } from '../config/app-config.module';
import { OidcAuthorizationCodeEntity } from '../database/entities/oidc-authorization-code.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { OidcPostLogoutRedirectUriEntity } from '../database/entities/oidc-post-logout-redirect-uri.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { SigningKeyEntity } from '../database/entities/signing-key.entity';
import { UserEntity } from '../database/entities/user.entity';
import { TokensModule } from '../tokens/tokens.module';
import { OidcAuthorizationService } from './oidc-authorization.service';
import { OidcController } from './oidc.controller';
import { OidcLogoutService } from './oidc-logout.service';
import { OidcTokenService } from './oidc-token.service';
import { TokenRateLimitService } from './token-rate-limit.service';

@Module({
  imports: [
    AppConfigModule,
    AuditModule,
    AuthenticationModule,
    TokensModule,
    TypeOrmModule.forFeature([
      OidcAuthorizationCodeEntity,
      OidcClientEntity,
      OidcPostLogoutRedirectUriEntity,
      OidcProviderSessionEntity,
      OidcRedirectUriEntity,
      SigningKeyEntity,
      UserEntity,
    ]),
  ],
  controllers: [OidcController],
  providers: [
    OidcAuthorizationService,
    OidcLogoutService,
    OidcTokenService,
    TokenRateLimitService,
  ],
})
export class OidcModule {}
