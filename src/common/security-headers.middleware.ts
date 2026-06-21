import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    res.setHeader(
      'content-security-policy',
      "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'",
    );
    res.setHeader(
      'strict-transport-security',
      'max-age=31536000; includeSubDomains',
    );

    next();
  }
}
