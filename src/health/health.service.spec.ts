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
});
