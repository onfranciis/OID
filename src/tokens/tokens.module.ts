import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { OidcRefreshTokenEntity } from '../database/entities/oidc-refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([OidcRefreshTokenEntity]), AuditModule],
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
})
export class TokensModule {}
