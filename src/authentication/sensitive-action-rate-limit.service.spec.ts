import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../config/app-config.service';
import { SensitiveActionRateLimitService } from './sensitive-action-rate-limit.service';

describe('SensitiveActionRateLimitService', () => {
  let service: SensitiveActionRateLimitService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
    service = new SensitiveActionRateLimitService({
      get: vi.fn((key: string) => {
        if (key === 'authentication.loginRateLimitWindowSeconds') {
          return 60;
        }

        if (key === 'authentication.loginRateLimitIpMaxAttempts') {
          return 2;
        }

        if (key === 'authentication.loginRateLimitAccountMaxAttempts') {
          return 2;
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as AppConfigService);
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

  it('limits a single target email across source IPs', () => {
    service.assertAllowed('10.0.0.1', 'victim@company.com');
    service.assertAllowed('10.0.0.2', 'victim@company.com');

    expect(() =>
      service.assertAllowed('10.0.0.3', 'victim@company.com'),
    ).toThrow(HttpException);
    expect(() =>
      service.assertAllowed('10.0.0.3', 'someone-else@company.com'),
    ).not.toThrow();
  });

  it('treats email keys case-insensitively and ignores blanks', () => {
    service.assertAllowed('10.0.0.1', 'Victim@Company.com');
    service.assertAllowed('10.0.0.2', 'victim@company.com');

    expect(() =>
      service.assertAllowed('10.0.0.3', 'VICTIM@COMPANY.COM'),
    ).toThrow(HttpException);
    expect(() => service.assertAllowed(null, '   ')).not.toThrow();
  });

  it('does not block requests without an IP address or email', () => {
    expect(() => {
      service.assertAllowed(null);
      service.assertAllowed(null);
      service.assertAllowed(null);
    }).not.toThrow();
  });
});
