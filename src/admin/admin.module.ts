import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupMembershipEntity } from '../database/entities/group-membership.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AdminAccessService } from './admin-access.service';
import { AdminClientService } from './admin-client.service';
import { AdminController } from './admin.controller';
import { AdminGroupService } from './admin-group.service';
import { AdminGuard } from './admin.guard';
import { AdminPageService } from './admin-page.service';
import { AdminUserService } from './admin-user.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      UserEntity,
      GroupEntity,
      GroupMembershipEntity,
      OidcClientEntity,
      OidcProviderSessionEntity,
      OidcRedirectUriEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminAccessService,
    AdminClientService,
    AdminGroupService,
    AdminGuard,
    AdminPageService,
    AdminUserService,
  ],
})
export class AdminModule {}
