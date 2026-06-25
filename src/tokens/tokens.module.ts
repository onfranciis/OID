import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([OidcClientEntity]), AuditModule],
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
})
export class TokensModule {}
