import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns an ok status payload when the database responds', async () => {
    const service = new HealthService({
      query: () => Promise.resolve([{ '?column?': 1 }]),
    } as never);

    await expect(service.getStatus()).resolves.toEqual({
      service: 'internal-id',
      status: 'ok',
      database: 'up',
    });
  });

  it('reports an error status when the database is unreachable', async () => {
    const service = new HealthService({
      query: () => Promise.reject(new Error('connection refused')),
    } as never);

    await expect(service.getStatus()).resolves.toEqual({
      service: 'internal-id',
      status: 'error',
      database: 'down',
    });
  });
});
