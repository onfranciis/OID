import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class BetterAuthConfigService {
  constructor(private readonly configService: AppConfigService) {}

  get basePath(): string {
    return this.configService.get('betterAuth.basePath');
  }

  get cookieName(): string {
    return this.configService.get('betterAuth.cookieName');
  }

  get secret(): string {
    return this.configService.get('betterAuth.secret');
  }

  get loginPath(): string {
    return this.configService.get('betterAuth.loginPath');
  }
}
