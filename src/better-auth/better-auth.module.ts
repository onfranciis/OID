import { Module } from '@nestjs/common';
import { BetterAuthConfigService } from './better-auth.config';

@Module({
  providers: [BetterAuthConfigService],
  exports: [BetterAuthConfigService],
})
export class BetterAuthModule {}
