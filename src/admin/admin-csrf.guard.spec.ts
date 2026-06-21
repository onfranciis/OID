import { describe, expect, it, vi } from 'vitest';
import { AdminCsrfGuard } from './admin-csrf.guard';

describe('AdminCsrfGuard', () => {
  it('accepts CSRF tokens from headers', () => {
    const assertToken = vi.fn();
    const guard = new AdminCsrfGuard({
      getCookieName: () => 'csrf',
      assertToken,
    } as never);

    expect(
      guard.canActivate(
        buildExecutionContext({
          headers: {
            cookie: 'csrf=cookie-token',
            'x-csrf-token': 'header-token',
          },
        }),
      ),
    ).toBe(true);
    expect(assertToken).toHaveBeenCalledWith('header-token', 'cookie-token');
  });

  it('accepts CSRF tokens from request bodies', () => {
    const assertToken = vi.fn();
    const guard = new AdminCsrfGuard({
      getCookieName: () => 'csrf',
      assertToken,
    } as never);

    expect(
      guard.canActivate(
        buildExecutionContext({
          headers: {
            cookie: 'csrf=cookie-token',
          },
          body: {
            csrfToken: 'body-token',
          },
        }),
      ),
    ).toBe(true);
    expect(assertToken).toHaveBeenCalledWith('body-token', 'cookie-token');
  });
});

function buildExecutionContext(request: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
