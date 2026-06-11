import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BetterAuthConfigService {
  constructor(private readonly configService: ConfigService) {}

  get basePath(): string {
    return this.configService.getOrThrow<string>('betterAuth.basePath');
  }

  get cookieName(): string {
    return this.configService.getOrThrow<string>('betterAuth.cookieName');
  }
}
