import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OAuthErrorFilter } from './oauth-error.filter';

describe('OAuthErrorFilter', () => {
  it('maps detailed OAuth exceptions to generic errors', () => {
    expect(catchException(new BadRequestException('code is required'))).toEqual(
      {
        status: 400,
        payload: {
          error: 'invalid_request',
        },
      },
    );
    expect(
      catchException(new UnauthorizedException('Invalid code_verifier.')),
    ).toEqual({
      status: 401,
      payload: {
        error: 'invalid_grant',
      },
    });
    expect(catchException(new ConflictException('replay detected'))).toEqual({
      status: 409,
      payload: {
        error: 'invalid_grant',
      },
    });
  });

  it('maps rate limit and unknown HTTP errors generically', () => {
    expect(
      catchException(
        new HttpException('blocked', HttpStatus.TOO_MANY_REQUESTS),
      ),
    ).toEqual({
      status: 429,
      payload: {
        error: 'temporarily_unavailable',
      },
    });
    expect(
      catchException(
        new HttpException('specific failure', HttpStatus.INTERNAL_SERVER_ERROR),
      ),
    ).toEqual({
      status: 500,
      payload: {
        error: 'server_error',
      },
    });
  });
});

function catchException(exception: HttpException) {
  const json = vi.fn<(payload: unknown) => void>();
  const status = vi.fn<(statusCode: number) => { json: typeof json }>(() => ({
    json,
  }));
  const filter = new OAuthErrorFilter();

  filter.catch(exception, {
    switchToHttp: () => ({
      getResponse: () => ({
        status,
      }),
    }),
  } as never);

  return {
    status: status.mock.calls[0]?.[0] as number | undefined,
    payload: json.mock.calls[0]?.[0],
  };
}
