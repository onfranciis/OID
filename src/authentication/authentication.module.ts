import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { BetterAuthModule } from '../better-auth/better-auth.module';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import { PasswordResetEntity } from '../database/entities/password-reset.entity';
import { UserInviteEntity } from '../database/entities/user-invite.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { AuthApiController } from './auth-api.controller';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { InviteAcceptService } from './invite-accept.service';
import { InviteApiController } from './invite-api.controller';
import { LoginRateLimitService } from './login-rate-limit.service';
import { PasswordResetApiController } from './password-reset-api.controller';
import { PasswordResetService } from './password-reset.service';
import { ProviderSessionService } from './provider-session.service';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    BetterAuthModule,
    MailModule,
    TypeOrmModule.forFeature([
      UserEntity,
      OidcProviderSessionEntity,
      OidcRefreshTokenEntity,
      UserInviteEntity,
      PasswordResetEntity,
    ]),
  ],
  controllers: [
    AuthenticationController,
    AuthApiController,
    InviteApiController,
    PasswordResetApiController,
  ],
  providers: [
    AuthenticationService,
    InviteAcceptService,
    LoginRateLimitService,
    PasswordResetService,
    ProviderSessionService,
  ],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
