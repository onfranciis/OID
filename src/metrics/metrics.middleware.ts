import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationSeconds =
        Number(process.hrtime.bigint() - start) / 1_000_000_000;

      this.metricsService.recordRequest({
        method: req.method,
        route: normalizeRoute(req.path),
        statusCode: res.statusCode,
        durationSeconds,
      });
    });

    next();
  }
}

function normalizeRoute(path: string): string {
  if (path.startsWith('/oauth/token')) {
    return '/oauth/token';
  }

  if (path.startsWith('/oauth/revoke')) {
    return '/oauth/revoke';
  }

  if (path.startsWith('/admin/login')) {
    return '/admin/login';
  }

  if (path.startsWith('/api/auth')) {
    return '/api/auth/*';
  }

  if (path.startsWith('/admin/api/auth/password-reset')) {
    return '/admin/api/auth/password-reset/:token';
  }

  if (path.startsWith('/admin/api/invites')) {
    return '/admin/api/invites/:token';
  }

  if (path.startsWith('/admin/reset-password')) {
    return '/admin/reset-password/:token';
  }

  if (path === '/admin/invite') {
    return '/admin/invite';
  }

  if (path.startsWith('/admin/invite/')) {
    return '/admin/invite/:token';
  }

  if (path.startsWith('/admin/api/') || path.startsWith('/admin/')) {
    return templateAdminSegments(path);
  }

  return path;
}

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9_.:-]{20,}$/;

function templateAdminSegments(path: string): string {
  const segments = path.split('/');

  return segments
    .map((segment, index) => {
      if (index === 0 || segment.length === 0) {
        return segment;
      }

      if (OPAQUE_ID_PATTERN.test(segment)) {
        return ':id';
      }

      return segment;
    })
    .join('/');
}
