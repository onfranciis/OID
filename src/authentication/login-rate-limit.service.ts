import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class LoginRateLimitService {
  private readonly accountBuckets = new Map<string, RateLimitBucket>();
  private readonly ipBuckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly ipMaxAttempts: number;
  private readonly accountMaxAttempts: number;

  constructor(configService: ConfigService) {
    this.windowMs =
      configService.getOrThrow<number>(
        'authentication.loginRateLimitWindowSeconds',
      ) * 1000;
    this.ipMaxAttempts = configService.getOrThrow<number>(
      'authentication.loginRateLimitIpMaxAttempts',
    );
    this.accountMaxAttempts = configService.getOrThrow<number>(
      'authentication.loginRateLimitAccountMaxAttempts',
    );
  }

  assertAllowed(ipAddress: string | null, normalizedEmail: string): void {
    const now = Date.now();

    if (
      this.isBlocked(
        this.accountBuckets,
        normalizedEmail,
        this.accountMaxAttempts,
        now,
      )
    ) {
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      ipAddress &&
      this.isBlocked(this.ipBuckets, ipAddress, this.ipMaxAttempts, now)
    ) {
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(ipAddress: string | null, normalizedEmail: string): void {
    const now = Date.now();

    this.increment(this.accountBuckets, normalizedEmail, now);

    if (ipAddress) {
      this.increment(this.ipBuckets, ipAddress, now);
    }
  }

  recordSuccess(ipAddress: string | null, normalizedEmail: string): void {
    this.accountBuckets.delete(normalizedEmail);

    if (ipAddress) {
      this.ipBuckets.delete(ipAddress);
    }
  }

  private increment(
    buckets: Map<string, RateLimitBucket>,
    key: string,
    now: number,
  ): void {
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return;
    }

    existing.count += 1;
  }

  private isBlocked(
    buckets: Map<string, RateLimitBucket>,
    key: string,
    maxAttempts: number,
    now: number,
  ): boolean {
    const bucket = buckets.get(key);

    if (!bucket) {
      return false;
    }

    if (bucket.resetAt <= now) {
      buckets.delete(key);
      return false;
    }

    return bucket.count >= maxAttempts;
  }
}
