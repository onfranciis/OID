import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { BetterAuthModule } from '../better-auth/better-auth.module';
import { AuditEventEntity } from '../database/entities/audit-event.entity';
import { GroupMembershipEntity } from '../database/entities/group-membership.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AdminAccessService } from './admin-access.service';
import { AdminAccountService } from './admin-account.service';
import { AdminApiController } from './admin-api.controller';
import { AdminAuditService } from './admin-audit.service';
import { AdminClientService } from './admin-client.service';
import { AdminCsrfGuard } from './admin-csrf.guard';
import { AdminCsrfService } from './admin-csrf.service';
import { AdminGroupService } from './admin-group.service';
import { AdminGuard } from './admin.guard';
import { AdminRecentAuthGuard } from './admin-recent-auth.guard';
import { AdminUserService } from './admin-user.service';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    BetterAuthModule,
    TypeOrmModule.forFeature([
      AuditEventEntity,
      UserEntity,
      GroupEntity,
      GroupMembershipEntity,
      OidcClientEntity,
      OidcProviderSessionEntity,
      OidcRefreshTokenEntity,
      OidcRedirectUriEntity,
    ]),
  ],
  controllers: [AdminApiController],
  providers: [
    AdminAccessService,
    AdminAccountService,
    AdminAuditService,
    AdminClientService,
    AdminCsrfGuard,
    AdminCsrfService,
    AdminGroupService,
    AdminGuard,
    AdminRecentAuthGuard,
    AdminUserService,
  ],
})
export class AdminModule {}
