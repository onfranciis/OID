import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

function recordPath(path: string): string {
  const metrics = new MetricsService();
  const middleware = new MetricsMiddleware(metrics);
  const response = new EventEmitter() as EventEmitter & {
    statusCode: number;
  };
  response.statusCode = 200;

  middleware.use(
    { method: 'GET', path } as never,
    response as never,
    vi.fn(),
  );
  response.emit('finish');

  const output = metrics.renderPrometheus();
  const match = output.match(/route="([^"]+)"/);

  return match?.[1] as string;
}

describe('MetricsMiddleware', () => {
  it('keeps existing static route labels unchanged', () => {
    expect(recordPath('/oauth/token')).toBe('/oauth/token');
    expect(recordPath('/oauth/revoke')).toBe('/oauth/revoke');
    expect(recordPath('/admin/login')).toBe('/admin/login');
    expect(recordPath('/api/auth/session')).toBe('/api/auth/*');
    expect(recordPath('/health')).toBe('/health');
  });

  it.each([
    '/admin/api/auth/password-reset/raw-token-value',
    '/admin/api/invites/raw-token-value',
    '/admin/api/invites/raw-token-value/accept',
    '/admin/reset-password/raw-token-value',
    '/admin/invite/raw-token-value',
  ])('never uses live tokens as labels (%s)', (path) => {
    const route = recordPath(path);

    expect(route).not.toContain('raw-token-value');
  });

  it('templates opaque admin resource ids', () => {
    expect(recordPath('/admin/api/users/usr_01hq8he9k2m3n4p5q6r7s8t9')).toBe(
      '/admin/api/users/:id',
    );
    expect(recordPath('/admin/api/session')).toBe('/admin/api/session');
  });
});
