import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns the service payload when the database is up', async () => {
    const payload = { service: 'internal-id', status: 'ok', database: 'up' };
    const controller = new HealthController({
      getStatus: vi.fn(() => Promise.resolve(payload)),
    } as unknown as HealthService);

    await expect(controller.getStatus()).resolves.toEqual(payload);
  });

  it('responds with 503 when the database is down', async () => {
    const payload = {
      service: 'internal-id',
      status: 'error',
      database: 'down',
    };
    const controller = new HealthController({
      getStatus: vi.fn(() => Promise.resolve(payload)),
    } as unknown as HealthService);

    await expect(controller.getStatus()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
