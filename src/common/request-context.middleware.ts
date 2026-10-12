import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('x-request-id', resolveRequestId(req.header('x-request-id')));

    next();
  }
}

function resolveRequestId(headerValue: string | undefined): string {
  if (headerValue !== undefined) {
    const candidate = headerValue.trim();

    if (
      candidate.length > 0 &&
      candidate.length <= MAX_REQUEST_ID_LENGTH &&
      SAFE_REQUEST_ID_PATTERN.test(candidate)
    ) {
      return candidate;
    }
  }

  return randomUUID();
}
