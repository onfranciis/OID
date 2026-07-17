import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';

interface LoggedError {
  level: string;
  requestId: string | null;
  method: string;
  path: string;
  statusCode: number;
  errorName: string;
  errorMessage: string;
}

function parseLoggedError(raw: unknown): LoggedError {
  return JSON.parse(raw as string) as LoggedError;
}

function makeHost(overrides?: { requestIdHeader?: string }) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const getHeader = vi.fn(() => undefined);
  const request = {
    method: 'GET',
    path: '/admin/api/users',
    header: vi.fn(() => overrides?.requestIdHeader),
  };
  const response = { status, getHeader };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json, request, response };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    consoleError.mockClear();
  });

  it('passes a known 4xx HttpException through unchanged and does not log', () => {
    const { host, status, json } = makeHost();

    filter.catch(new NotFoundException('User not found.'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'User not found.',
      error: 'Not Found',
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('preserves a BadRequestException message and status', () => {
    const { host, status, json } = makeHost();

    filter.catch(new BadRequestException('newPassword is required.'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'newPassword is required.',
      error: 'Bad Request',
    });
  });

  it('sanitizes an unexpected non-HttpException error to a generic 500 and logs the real error', () => {
    const { host, status, json, request } = makeHost({
      requestIdHeader: 'req-abc',
    });
    const error = new Error('relation "users" does not exist');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(request.header).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledOnce();

    const logged = parseLoggedError(consoleError.mock.calls[0]?.[0]);
    expect(logged).toMatchObject({
      level: 'error',
      requestId: 'req-abc',
      method: 'GET',
      path: '/admin/api/users',
      statusCode: 500,
      errorMessage: 'relation "users" does not exist',
    });
  });

  it('sanitizes even a deliberately-thrown 5xx HttpException, never trusting its message', () => {
    const { host, status, json } = makeHost();

    filter.catch(
      new InternalServerErrorException('stack trace: /etc/passwd leaked'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('sanitizes a non-Error thrown value (e.g. a string or plain object)', () => {
    const { host, status, json } = makeHost();

    filter.catch('a raw string throw', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });

    const logged = parseLoggedError(consoleError.mock.calls[0]?.[0]);
    expect(logged.errorName).toBe('UnknownError');
    expect(logged.errorMessage).toBe('a raw string throw');
  });
});
