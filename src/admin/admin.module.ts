import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupMembershipEntity } from '../database/entities/group-membership.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AdminAccessService } from './admin-access.service';
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
      OidcProviderSessionEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminAccessService,
    AdminGroupService,
    AdminGuard,
    AdminPageService,
    AdminUserService,
  ],
})
export class AdminModule {}
