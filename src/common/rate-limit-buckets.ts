export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

// Upper bound per in-memory bucket map. Steady state stays far below this
// since entries expire with their windows; the cap only bites during a
// distinct-key flood, where pruning expired entries first and then evicting
// the oldest keeps memory bounded without dropping fresh legitimate keys
// while room remains.
export const MAX_RATE_LIMIT_BUCKETS = 10000;

export function storeRateLimitBucket(
  buckets: Map<string, RateLimitBucket>,
  key: string,
  bucket: RateLimitBucket,
  now: number,
): void {
  if (!buckets.has(key) && buckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    pruneExpiredRateLimitBuckets(buckets, now);

    if (buckets.size >= MAX_RATE_LIMIT_BUCKETS) {
      const oldest = buckets.keys().next();

      if (!oldest.done) {
        buckets.delete(oldest.value);
      }
    }
  }

  buckets.set(key, bucket);
}

export function pruneExpiredRateLimitBuckets(
  buckets: Map<string, RateLimitBucket>,
  now: number,
): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
