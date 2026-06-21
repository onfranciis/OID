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

  if (path.startsWith('/login')) {
    return '/login';
  }

  if (path.startsWith('/api/auth')) {
    return '/api/auth/*';
  }

  return path;
}
