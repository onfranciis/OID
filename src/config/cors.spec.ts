import { describe, expect, it } from 'vitest';
import { parseCorsAllowedOrigins } from './cors';

describe('parseCorsAllowedOrigins', () => {
  it('returns an empty list when unset', () => {
    expect(parseCorsAllowedOrigins(undefined)).toEqual([]);
    expect(parseCorsAllowedOrigins('')).toEqual([]);
    expect(parseCorsAllowedOrigins(' , ')).toEqual([]);
  });

  it('parses and dedupes origins', () => {
    expect(
      parseCorsAllowedOrigins(
        'https://app.company.com, https://admin.company.com ,https://app.company.com',
      ),
    ).toEqual(['https://app.company.com', 'https://admin.company.com']);
  });

  it('rejects non origins and non http schemes', () => {
    expect(() => parseCorsAllowedOrigins('not-a-url')).toThrow(
      /not a valid origin/,
    );
    expect(() => parseCorsAllowedOrigins('*')).toThrow();
    expect(() => parseCorsAllowedOrigins('https://app.company.com/callback')).toThrow(
      /plain http\(s\) origin/,
    );
    expect(() => parseCorsAllowedOrigins('ftp://files.company.com')).toThrow(
      /plain http\(s\) origin/,
    );
  });
});
