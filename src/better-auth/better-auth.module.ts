import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TokensModule } from '../tokens/tokens.module';
import { BetterAuthController } from './better-auth.controller';
import { BetterAuthConfigService } from './better-auth.config';
import { BetterAuthService } from './better-auth.service';

@Module({
  imports: [AuditModule, TokensModule],
  controllers: [BetterAuthController],
  providers: [BetterAuthConfigService, BetterAuthService],
  exports: [BetterAuthConfigService, BetterAuthService],
})
export class BetterAuthModule {}
