import { describe, expect, it } from 'vitest';
import {
  MAX_RATE_LIMIT_BUCKETS,
  pruneExpiredRateLimitBuckets,
  storeRateLimitBucket,
  type RateLimitBucket,
} from './rate-limit-buckets';

describe('rate-limit-buckets', () => {
  it('prunes only expired entries', () => {
    const buckets = new Map<string, RateLimitBucket>([
      ['old', { count: 3, resetAt: 999 }],
      ['live', { count: 1, resetAt: 2000 }],
    ]);

    pruneExpiredRateLimitBuckets(buckets, 1000);

    expect([...buckets.keys()]).toEqual(['live']);
  });

  it('caps the map by evicting the oldest entry when full of live buckets', () => {
    const buckets = new Map<string, RateLimitBucket>();

    for (let index = 0; index < MAX_RATE_LIMIT_BUCKETS; index += 1) {
      buckets.set(`key-${index}`, { count: 1, resetAt: 2000 });
    }

    storeRateLimitBucket(buckets, 'new-key', { count: 1, resetAt: 2000 }, 1000);

    expect(buckets.size).toBe(MAX_RATE_LIMIT_BUCKETS);
    expect(buckets.has('new-key')).toBe(true);
    expect(buckets.has('key-0')).toBe(false);
    expect(buckets.has('key-1')).toBe(true);
  });

  it('prefers pruning expired entries over evicting live ones', () => {
    const buckets = new Map<string, RateLimitBucket>();

    for (let index = 0; index < MAX_RATE_LIMIT_BUCKETS; index += 1) {
      buckets.set(`key-${index}`, { count: 1, resetAt: 500 });
    }

    storeRateLimitBucket(buckets, 'new-key', { count: 1, resetAt: 2000 }, 1000);

    expect(buckets.has('new-key')).toBe(true);
    expect(buckets.has('key-0')).toBe(false);
    expect(buckets.size).toBe(1);
  });

  it('updates existing keys without evicting', () => {
    const buckets = new Map<string, RateLimitBucket>();

    for (let index = 0; index < MAX_RATE_LIMIT_BUCKETS; index += 1) {
      buckets.set(`key-${index}`, { count: 1, resetAt: 2000 });
    }

    storeRateLimitBucket(
      buckets,
      'key-5',
      { count: 9, resetAt: 2000 },
      1000,
    );

    expect(buckets.size).toBe(MAX_RATE_LIMIT_BUCKETS);
    expect(buckets.get('key-5')).toEqual({ count: 9, resetAt: 2000 });
  });
});
