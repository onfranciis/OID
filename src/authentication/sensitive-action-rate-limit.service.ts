import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

// Upper bound per bucket map. Steady state stays far below it since entries
// expire with their windows; the cap only bites during a distinct-key flood.
const MAX_BUCKETS = 10000;

// Covers the unauthenticated reset/invite endpoints with the same token
// bucket shape as the login and OIDC limiters, minus the cross-module import
// (OidcModule already imports AuthenticationModule, so sharing that service
// would be circular). Reuses the login rate-limit knobs so one window governs
// login, reset, and invite traffic and operators tune a single place. Buckets
// are keyed per IP and, where a target email is known, per address too, so one
// inbox cannot be mail-bombed from many source IPs without tripping the
// address bucket.
@Injectable()
export class SensitiveActionRateLimitService {
  private readonly ipBuckets = new Map<string, RateLimitBucket>();
  private readonly emailBuckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly ipMaxAttempts: number;
  private readonly emailMaxAttempts: number;

  constructor(configService: AppConfigService) {
    this.windowMs =
      configService.get('authentication.loginRateLimitWindowSeconds') * 1000;
    this.ipMaxAttempts = configService.get(
      'authentication.loginRateLimitIpMaxAttempts',
    );
    this.emailMaxAttempts = configService.get(
      'authentication.loginRateLimitAccountMaxAttempts',
    );
  }

  assertAllowed(ipAddress: string | null, targetEmail?: string | null): void {
    const now = Date.now();
    const normalizedEmail = normalizeEmail(targetEmail);

    if (
      (ipAddress &&
        this.isBlocked(this.ipBuckets, ipAddress, this.ipMaxAttempts, now)) ||
      (normalizedEmail &&
        this.isBlocked(
          this.emailBuckets,
          normalizedEmail,
          this.emailMaxAttempts,
          now,
        ))
    ) {
      throw new HttpException(
        'Too many requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (ipAddress) {
      this.increment(this.ipBuckets, ipAddress, now);
    }

    if (normalizedEmail) {
      this.increment(this.emailBuckets, normalizedEmail, now);
    }
  }

  private increment(
    buckets: Map<string, RateLimitBucket>,
    key: string,
    now: number,
  ): void {
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      storeBucket(
        buckets,
        key,
        { count: 1, resetAt: now + this.windowMs },
        now,
      );
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

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function storeBucket(
  buckets: Map<string, RateLimitBucket>,
  key: string,
  bucket: RateLimitBucket,
  now: number,
): void {
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    for (const [storedKey, stored] of buckets) {
      if (stored.resetAt <= now) {
        buckets.delete(storedKey);
      }
    }

    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next();

      if (!oldest.done) {
        buckets.delete(oldest.value);
      }
    }
  }

  buckets.set(key, bucket);
}
