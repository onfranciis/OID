import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { StructuredLoggerMiddleware } from './structured-logger.middleware';

describe('StructuredLoggerMiddleware', () => {
  it('logs request completion as JSON with request context', () => {
    const middleware = new StructuredLoggerMiddleware();
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      getHeader: (name: string) => string | undefined;
    };
    const next = vi.fn();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    response.statusCode = 200;
    response.getHeader = vi.fn((name: string) =>
      name === 'x-request-id' ? 'req_123' : undefined,
    );

    try {
      middleware.use(
        {
          method: 'GET',
          path: '/health',
          header: vi.fn(),
        } as never,
        response as never,
        next,
      );

      response.emit('finish');

      expect(next).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(expect.any(String));
      expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
        level: 'info',
        service: 'internal-id',
        requestId: 'req_123',
        method: 'GET',
        path: '/health',
        statusCode: 200,
      });
    } finally {
      log.mockRestore();
    }
  });
});
