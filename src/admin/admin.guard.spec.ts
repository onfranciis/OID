import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminGuard } from './admin.guard';

const COOKIE_NAME = 'internal_id_provider_session';

function buildGuard(requireAdminAccess: (...args: never[]) => unknown) {
  return new AdminGuard(
    { get: vi.fn(() => COOKIE_NAME) } as never,
    { requireAdminAccess: vi.fn(requireAdminAccess) } as never,
  );
}

function buildContext(cookieHeader: string | undefined) {
  const request: { headers: { cookie?: string }; adminPrincipal?: unknown } = {
    headers: {},
  };

  if (cookieHeader !== undefined) {
    request.headers.cookie = cookieHeader;
  }

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  } as never;
}

describe('AdminGuard', () => {
  it('passes the session cookie through and stores the principal', async () => {
    const principal = { user: { id: 'usr_1' } };
    const requireAdminAccess = vi.fn(() => Promise.resolve(principal));
    const guard = buildGuard(requireAdminAccess);
    const context = buildContext(`${COOKIE_NAME}=session-token; other=1`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(requireAdminAccess).toHaveBeenCalledWith({
      providerSessionToken: 'session-token',
    });
    expect(context.request.adminPrincipal).toBe(principal);
  });

  it('sends null when the session cookie is missing', async () => {
    const requireAdminAccess = vi.fn(() =>
      Promise.reject(new UnauthorizedException('Admin authentication required.')),
    );
    const guard = buildGuard(requireAdminAccess);

    await expect(
      guard.canActivate(buildContext(undefined)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(requireAdminAccess).toHaveBeenCalledWith({
      providerSessionToken: null,
    });
  });

  it('propagates expired or unknown sessions', async () => {
    const requireAdminAccess = vi.fn(() =>
      Promise.reject(new UnauthorizedException('Admin session expired.')),
    );
    const guard = buildGuard(requireAdminAccess);

    await expect(
      guard.canActivate(buildContext(`${COOKIE_NAME}=stale-token`)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('propagates non admin users', async () => {
    const requireAdminAccess = vi.fn(() =>
      Promise.reject(new ForbiddenException('Admin access denied.')),
    );
    const guard = buildGuard(requireAdminAccess);

    await expect(
      guard.canActivate(buildContext(`${COOKIE_NAME}=session-token`)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
