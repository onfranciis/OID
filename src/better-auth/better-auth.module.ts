import { Module } from '@nestjs/common';
import { BetterAuthController } from './better-auth.controller';
import { BetterAuthConfigService } from './better-auth.config';
import { BetterAuthService } from './better-auth.service';

@Module({
  controllers: [BetterAuthController],
  providers: [BetterAuthConfigService, BetterAuthService],
  exports: [BetterAuthConfigService, BetterAuthService],
})
export class BetterAuthModule {}
