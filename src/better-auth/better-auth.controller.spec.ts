import { Test, TestingModule } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuditService } from '../audit/audit.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { BetterAuthController } from './better-auth.controller';
import { BetterAuthService } from './better-auth.service';

describe('BetterAuthController', () => {
  let controller: BetterAuthController;
  const handle = vi.fn(() => Promise.resolve());
  const record = vi.fn(() => Promise.resolve('evt_test'));

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BetterAuthController],
      providers: [
        {
          provide: BetterAuthService,
          useValue: {
            handle,
          },
        },
        {
          provide: AuditService,
          useValue: {
            record,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(BetterAuthController);
  });

  beforeEach(() => {
    handle.mockClear();
    record.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('passes supported authorize requests through to Better Auth', async () => {
    await expect(
      controller.authorize(
        {
          query: {
            response_type: 'code',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'S256',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        } as never,
        { statusCode: 302 } as never,
      ),
    ).resolves.toBeUndefined();

    expect(handle).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.authorize.request.accepted',
        severity: AuditSeverity.INFO,
      }),
    );
  });

  it('rejects unsupported authorize response types at the controller boundary', async () => {
    await expect(
      controller.authorize(
        {
          query: {
            response_type: 'token',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'S256',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        } as never,
        {} as never,
      ),
    ).rejects.toThrow(/response_type=code/);

    expect(handle).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.authorize.request.rejected',
        severity: AuditSeverity.WARNING,
      }),
    );
  });

  it('rejects plain PKCE at the controller boundary', async () => {
    await expect(
      controller.authorize(
        {
          query: {
            response_type: 'code',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'plain',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        } as never,
        {} as never,
      ),
    ).rejects.toThrow(/S256/);

    expect(handle).not.toHaveBeenCalled();
  });

  it('passes supported token grants through to Better Auth', async () => {
    await expect(
      controller.token(
        {
          body: {
            grant_type: 'authorization_code',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        } as never,
        { statusCode: 200 } as never,
      ),
    ).resolves.toBeUndefined();

    expect(handle).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.token.request.accepted',
        severity: AuditSeverity.INFO,
      }),
    );
  });

  it('rejects unsupported token grants at the controller boundary', async () => {
    await expect(
      controller.token(
        {
          body: {
            grant_type: 'client_credentials',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        } as never,
        {} as never,
      ),
    ).rejects.toThrow(/authorization_code and refresh_token/);

    expect(handle).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.token.request.rejected',
        severity: AuditSeverity.WARNING,
      }),
    );
  });

  it('blocks dynamic registration routes before Better Auth sees them', async () => {
    await expect(
      controller.blockRegister({
        body: {},
        ip: '127.0.0.1',
        get: vi.fn(() => 'test-agent'),
      } as never),
    ).rejects.toThrow(/Dynamic client registration/);

    expect(handle).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'client.registration.blocked',
        severity: AuditSeverity.WARNING,
      }),
    );
  });
});
