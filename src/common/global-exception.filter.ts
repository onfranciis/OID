import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const GENERIC_SERVER_ERROR = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  message: 'Internal server error',
  error: 'Internal Server Error',
};

interface ErrorEnvelope {
  statusCode: number;
  message: string | string[];
  error: string;
}

// Catches everything that escapes route handlers/services. Nest's own
// HttpExceptions (BadRequestException, NotFoundException, etc.) already carry
// a safe, deliberate message, so those pass through unchanged; anything else
// (TypeORM errors, programming errors, a mis-thrown 500) is unexpected and
// must never leak its message/stack to the client (ROADMAP.md B-04) — only
// into the server-side structured log, keyed by the same x-request-id the
// access log uses.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status = getHttpStatus(exception);
    const body = getSafeBody(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      logUnexpectedError(exception, request, response, status);
    }

    response.status(status).json(body);
  }
}

function getHttpStatus(exception: unknown): HttpStatus {
  return exception instanceof HttpException
    ? exception.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

function getSafeBody(exception: unknown, status: HttpStatus): ErrorEnvelope {
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return GENERIC_SERVER_ERROR;
  }

  if (exception instanceof HttpException) {
    const raw = exception.getResponse();

    return typeof raw === 'string'
      ? { statusCode: status, message: raw, error: exception.name }
      : (raw as ErrorEnvelope);
  }

  return GENERIC_SERVER_ERROR;
}

function logUnexpectedError(
  exception: unknown,
  request: Request,
  response: Response,
  status: HttpStatus,
): void {
  const requestId =
    response.getHeader('x-request-id') ?? request.header('x-request-id');

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'internal-id',
      requestId: typeof requestId === 'string' ? requestId : null,
      method: request.method,
      path: request.path,
      statusCode: status,
      errorName: exception instanceof Error ? exception.name : 'UnknownError',
      errorMessage:
        exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    }),
  );
}
