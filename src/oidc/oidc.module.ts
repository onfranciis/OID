import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { OidcAuthorizationCodeEntity } from '../database/entities/oidc-authorization-code.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { UserEntity } from '../database/entities/user.entity';
import { OidcAuthorizationService } from './oidc-authorization.service';
import { OidcController } from './oidc.controller';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    TypeOrmModule.forFeature([
      OidcAuthorizationCodeEntity,
      OidcClientEntity,
      OidcProviderSessionEntity,
      OidcRedirectUriEntity,
      UserEntity,
    ]),
  ],
  controllers: [OidcController],
  providers: [OidcAuthorizationService],
})
export class OidcModule {}
