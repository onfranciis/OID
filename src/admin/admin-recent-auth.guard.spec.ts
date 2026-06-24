import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service';
import { AdminRecentAuthGuard } from './admin-recent-auth.guard';

describe('AdminRecentAuthGuard', () => {
  const guard = new AdminRecentAuthGuard({
    get: vi.fn(() => 600),
  } as unknown as AppConfigService);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
  });

  it('allows admin requests authenticated inside the recent window', () => {
    expect(
      guard.canActivate(
        buildExecutionContext(new Date('2026-06-21T11:55:00.000Z')),
      ),
    ).toBe(true);
  });

  it('rejects admin requests outside the recent window', () => {
    expect(() =>
      guard.canActivate(
        buildExecutionContext(new Date('2026-06-21T11:49:59.000Z')),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests without an admin principal auth time', () => {
    expect(() => guard.canActivate(buildExecutionContext(null))).toThrow(
      ForbiddenException,
    );
  });
});

function buildExecutionContext(authTime: Date | null) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        adminPrincipal: authTime
          ? {
              providerSession: {
                authTime,
              },
            }
          : undefined,
      }),
    }),
  } as never;
}
