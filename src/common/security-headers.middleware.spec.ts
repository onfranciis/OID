import { describe, expect, it, vi } from 'vitest';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  it('sets strict browser security headers', () => {
    const setHeader = vi.fn();
    const next = vi.fn();
    const middleware = new SecurityHeadersMiddleware();

    middleware.use({} as never, { setHeader } as never, next);

    expect(setHeader).toHaveBeenCalledWith('x-content-type-options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('referrer-policy', 'no-referrer');
    expect(setHeader).toHaveBeenCalledWith('x-frame-options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith(
      'strict-transport-security',
      'max-age=31536000; includeSubDomains',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'content-security-policy',
      expect.stringContaining("frame-ancestors 'none'"),
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
