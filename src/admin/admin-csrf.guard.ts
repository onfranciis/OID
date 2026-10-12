import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { parseCookies } from '../common/cookies';
import { AdminCsrfService } from './admin-csrf.service';

interface AdminCsrfRequest extends Request {
  body: {
    csrfToken?: unknown;
  };
}

@Injectable()
export class AdminCsrfGuard implements CanActivate {
  constructor(private readonly adminCsrfService: AdminCsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminCsrfRequest>();
    const submittedToken =
      getHeaderValue(request.headers['x-csrf-token']) ??
      getBodyToken(request.body);
    const cookieToken = parseCookies(request.headers.cookie)[
      this.adminCsrfService.getCookieName()
    ];

    this.adminCsrfService.assertToken(submittedToken, cookieToken);

    return true;
  }
}

function getBodyToken(body: AdminCsrfRequest['body']): string | undefined {
  return typeof body?.csrfToken === 'string' ? body.csrfToken : undefined;
}

function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}
