import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
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
