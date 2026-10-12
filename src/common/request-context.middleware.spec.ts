import { describe, expect, it, vi } from 'vitest';
import { RequestContextMiddleware } from './request-context.middleware';

function run(headerValue: string | undefined): string {
  const middleware = new RequestContextMiddleware();
  let sent: string | undefined;
  const next = vi.fn();

  middleware.use(
    { header: vi.fn(() => headerValue) } as never,
    { setHeader: vi.fn((_: string, value: string) => (sent = value)) } as never,
    next,
  );

  expect(next).toHaveBeenCalledOnce();
  return sent as string;
}

describe('RequestContextMiddleware', () => {
  it('keeps a well formed client request id', () => {
    expect(run('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')).toBe(
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    );
  });

  it('generates a fresh id when none is supplied', () => {
    const first = run(undefined);
    const second = run(undefined);

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(second).not.toBe(first);
  });

  it.each(['', '   ', 'id with spaces', 'a/b', 'x'.repeat(129), 'req\n123'])(
    'replaces unsafe request ids (%j) with a server generated one',
    (headerValue) => {
      const sent = run(headerValue);

      expect(sent).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(sent).not.toBe(headerValue.trim());
    },
  );
});
