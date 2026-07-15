import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// The SSR pages (login) carry no scripts, so the default policy forbids scripts
// entirely. The React admin SPA under /admin loads its own bundled (same-origin)
// scripts, so those routes get `script-src 'self'` instead.
const BASE_CSP =
  "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'";
const DEFAULT_CSP = `${BASE_CSP}; script-src 'none'`;
const ADMIN_APP_CSP = `${BASE_CSP}; script-src 'self'; img-src 'self' data:`;

function isAdminApp(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}

// Nest's `forRoutes('*')` mounts middleware per matched route, which strips
// `req.path`/`req.url` to the mount-relative value ('/'). `req.originalUrl`
// always holds the full request path, so classify from that.
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
