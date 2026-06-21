import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class TokenRateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly ipMaxAttempts: number;

  constructor(configService: ConfigService) {
    this.windowMs =
      configService.getOrThrow<number>(
        'authentication.tokenRateLimitWindowSeconds',
      ) * 1000;
    this.ipMaxAttempts = configService.getOrThrow<number>(
      'authentication.tokenRateLimitIpMaxAttempts',
    );
  }

  assertAllowed(ipAddress: string | null): void {
    if (!ipAddress) {
      return;
    }

    const now = Date.now();
    const bucket = this.buckets.get(ipAddress);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(ipAddress, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return;
    }

    if (bucket.count >= this.ipMaxAttempts) {
      throw new HttpException(
        'Too many token requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
  }
}
