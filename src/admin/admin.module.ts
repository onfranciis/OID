import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuditEventEntity } from '../database/entities/audit-event.entity';
import { GroupMembershipEntity } from '../database/entities/group-membership.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AdminAccessService } from './admin-access.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminClientService } from './admin-client.service';
import { AdminController } from './admin.controller';
import { AdminCsrfGuard } from './admin-csrf.guard';
import { AdminCsrfService } from './admin-csrf.service';
import { AdminGroupService } from './admin-group.service';
import { AdminGuard } from './admin.guard';
import { AdminPageService } from './admin-page.service';
import { AdminRecentAuthGuard } from './admin-recent-auth.guard';
import { AdminUserService } from './admin-user.service';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
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
  controllers: [AdminController],
  providers: [
    AdminAccessService,
    AdminAuditService,
    AdminClientService,
    AdminCsrfGuard,
    AdminCsrfService,
    AdminGroupService,
    AdminGuard,
    AdminPageService,
    AdminRecentAuthGuard,
    AdminUserService,
  ],
})
export class AdminModule {}
