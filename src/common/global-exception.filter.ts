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

// Known HttpExceptions pass through with their own message; anything else
// (a raw Error, a TypeORM failure) gets sanitized to a generic 500 — its real
// message/stack goes only to the server-side log, never the client.
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
