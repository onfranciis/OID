import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { parseCookies } from '../common/cookies';
import { AppConfigService } from '../config/app-config.service';
import {
  AdminAccessService,
  type AdminPrincipal,
} from './admin-access.service';

interface AdminRequest extends Request {
  adminPrincipal?: AdminPrincipal;
}

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly providerSessionCookieName: string;

  constructor(
    configService: AppConfigService,
    private readonly adminAccessService: AdminAccessService,
  ) {
    this.providerSessionCookieName = configService.get(
      'authentication.providerSessionCookieName',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const principal = await this.adminAccessService.requireAdminAccess({
      providerSessionToken:
        parseCookies(request.headers.cookie)[this.providerSessionCookieName] ??
        null,
    });

    request.adminPrincipal = principal;

    return true;
  }
}
