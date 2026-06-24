import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
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

function parseCookies(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return Object.fromEntries(
    headerValue
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          return [part, ''];
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}
