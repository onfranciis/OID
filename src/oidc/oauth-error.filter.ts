import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

interface OAuthErrorResponse {
  error: string;
}

@Catch(HttpException)
export class OAuthErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const payload = mapOAuthError(exception);

    response.status(status).json(payload);
  }
}

function mapOAuthError(exception: HttpException): OAuthErrorResponse {
  if (exception instanceof BadRequestException) {
    return {
      error: 'invalid_request',
    };
  }

  if (exception instanceof UnauthorizedException) {
    return {
      error: 'invalid_grant',
    };
  }

  if (exception instanceof ConflictException) {
    return {
      error: 'invalid_grant',
    };
  }

  if (exception.getStatus() === 429) {
    return {
      error: 'temporarily_unavailable',
    };
  }

  return {
    error: 'server_error',
  };
}
