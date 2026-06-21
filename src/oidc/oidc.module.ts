import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { OidcAuthorizationCodeEntity } from '../database/entities/oidc-authorization-code.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { SigningKeyEntity } from '../database/entities/signing-key.entity';
import { UserEntity } from '../database/entities/user.entity';
import { TokensModule } from '../tokens/tokens.module';
import { OidcAuthorizationService } from './oidc-authorization.service';
import { OidcController } from './oidc.controller';
import { OidcTokenService } from './oidc-token.service';
import { TokenRateLimitService } from './token-rate-limit.service';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    TokensModule,
    TypeOrmModule.forFeature([
      OidcAuthorizationCodeEntity,
      OidcClientEntity,
      OidcProviderSessionEntity,
      OidcRedirectUriEntity,
      SigningKeyEntity,
      UserEntity,
    ]),
  ],
  controllers: [OidcController],
  providers: [
    OidcAuthorizationService,
    OidcTokenService,
    TokenRateLimitService,
  ],
})
export class OidcModule {}
