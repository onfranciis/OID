import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns an ok status payload', () => {
    const service = new HealthService();

    expect(service.getStatus()).toEqual({
      service: 'internal-id',
      status: 'ok',
    });
  });
});
