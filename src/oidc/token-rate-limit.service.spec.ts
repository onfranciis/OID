import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenRateLimitService } from './token-rate-limit.service';

describe('TokenRateLimitService', () => {
  let service: TokenRateLimitService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
    service = new TokenRateLimitService({
      getOrThrow: vi.fn((key: string) => {
        if (key === 'authentication.tokenRateLimitWindowSeconds') {
          return 60;
        }

        if (key === 'authentication.tokenRateLimitIpMaxAttempts') {
          return 2;
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as ConfigService);
  });

  it('allows requests under the IP limit', () => {
    expect(() => service.assertAllowed('127.0.0.1')).not.toThrow();
    expect(() => service.assertAllowed('127.0.0.1')).not.toThrow();
  });

  it('blocks requests over the IP limit until the window resets', () => {
    service.assertAllowed('127.0.0.1');
    service.assertAllowed('127.0.0.1');

    expect(() => service.assertAllowed('127.0.0.1')).toThrow(HttpException);

    vi.setSystemTime(new Date('2026-06-21T12:01:01.000Z'));

    expect(() => service.assertAllowed('127.0.0.1')).not.toThrow();
  });

  it('does not block requests without an IP address', () => {
    expect(() => {
      service.assertAllowed(null);
      service.assertAllowed(null);
      service.assertAllowed(null);
    }).not.toThrow();
  });
});
