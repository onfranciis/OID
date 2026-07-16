import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { BetterAuthModule } from '../better-auth/better-auth.module';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AuthApiController } from './auth-api.controller';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import { ProviderSessionService } from './provider-session.service';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    BetterAuthModule,
    TypeOrmModule.forFeature([UserEntity, OidcProviderSessionEntity]),
  ],
  controllers: [AuthenticationController, AuthApiController],
  providers: [
    AuthenticationService,
    LoginRateLimitService,
    ProviderSessionService,
  ],
})
export class AuthenticationModule {}
