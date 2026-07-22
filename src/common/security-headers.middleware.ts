import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const BASE_CSP =
  "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'";
const DEFAULT_CSP = `${BASE_CSP}; script-src 'none'`;
const ADMIN_APP_CSP = `${BASE_CSP}; script-src 'self'; img-src 'self' data:`;

function isAdminApp(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}

// Under forRoutes('*'), req.path/req.url get stripped to '/' — req.originalUrl
// is the only reliable source for the real path.
function requestPathname(req: Request): string {
  const raw = req.originalUrl || req.url || '';
  const queryIndex = raw.indexOf('?');

  return queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
}

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    res.setHeader(
      'content-security-policy',
      isAdminApp(requestPathname(req)) ? ADMIN_APP_CSP : DEFAULT_CSP,
    );
    res.setHeader(
      'strict-transport-security',
      'max-age=31536000; includeSubDomains',
    );

    next();
  }
}
