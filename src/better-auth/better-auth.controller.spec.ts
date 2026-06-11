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
import { RefreshTokenService } from '../tokens/refresh-token.service';
import type {
  IssueRefreshTokenResult,
  ResolveRefreshGrantResult,
} from '../tokens/refresh-token.types';
import { BetterAuthController } from './better-auth.controller';
import { BetterAuthService } from './better-auth.service';
import { UserInfoPolicyService } from './userinfo-policy.service';

type DispatchFn = (
  req: unknown,
  overrides?: { body?: Record<string, unknown> },
) => Promise<Response>;

type AuthorizeRequest = Parameters<BetterAuthController['authorize']>[0];
type AuthorizeResponse = Parameters<BetterAuthController['authorize']>[1];
type RegisterRequest = Parameters<BetterAuthController['blockRegister']>[0];
type TokenRequest = Parameters<BetterAuthController['token']>[0];
type TokenResponse = Parameters<BetterAuthController['token']>[1];
type UserInfoRequest = Parameters<BetterAuthController['userInfo']>[0];
type UserInfoResponse = Parameters<BetterAuthController['userInfo']>[1];

type ExpressResponseStub = {
  statusCode: number;
  status: (code: number) => ExpressResponseStub;
  setHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

describe('BetterAuthController', () => {
  let controller: BetterAuthController;
  const handle = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const dispatch = vi.fn<DispatchFn>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          token_type: 'Bearer',
          expires_in: 900,
          id_token: buildIdToken('usr_123'),
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    ),
  );
  const record = vi.fn<(input: unknown) => Promise<string>>(() =>
    Promise.resolve('evt_test'),
  );
  const issueTokenForClient = vi.fn<
    (input: unknown) => Promise<IssueRefreshTokenResult | null>
  >(() => Promise.resolve(null));
  const resolveRefreshGrant = vi.fn<
    (refreshToken: string) => Promise<ResolveRefreshGrantResult>
  >(() =>
    Promise.resolve({
      upstreamRefreshToken: 'upstream-refresh-token',
      token: {
        id: 'rtk_123',
        familyId: 'rtf_123',
        userId: 'usr_123',
        clientId: 'cli_internal_123',
        providerSessionId: null,
      },
    }),
  );
  const rotateToken = vi.fn<
    (input: unknown) => Promise<IssueRefreshTokenResult>
  >(() =>
    Promise.resolve({
      refreshToken: 'wrapped-refresh-token',
      tokenId: 'rtk_next',
      familyId: 'rtf_123',
      idleExpiresAt: new Date('2026-06-11T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-06-11T01:00:00.000Z'),
    }),
  );
  const filterUserInfoClaims = vi.fn<
    (
      authorizationHeader: string | undefined,
      payload: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>
  >((_, payload) => Promise.resolve(payload));

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BetterAuthController],
      providers: [
        {
          provide: BetterAuthService,
          useValue: {
            handle,
            dispatch,
          },
        },
        {
          provide: AuditService,
          useValue: {
            record,
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            issueTokenForClient,
            resolveRefreshGrant,
            rotateToken,
          },
        },
        {
          provide: UserInfoPolicyService,
          useValue: {
            filterUserInfoClaims,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(BetterAuthController);
  });

  beforeEach(() => {
    handle.mockClear();
    dispatch.mockClear();
    record.mockClear();
    issueTokenForClient.mockClear();
    resolveRefreshGrant.mockClear();
    rotateToken.mockClear();
    filterUserInfoClaims.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('passes supported authorize requests through to Better Auth', async () => {
    await expect(
      controller.authorize(
        toAuthorizeRequest({
          query: {
            response_type: 'code',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'S256',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        }),
        toAuthorizeResponse({ statusCode: 302 }),
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
        toAuthorizeRequest({
          query: {
            response_type: 'token',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'S256',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        }),
        toAuthorizeResponse({}),
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
        toAuthorizeRequest({
          query: {
            response_type: 'code',
            state: 'opaque-state',
            code_challenge: 'opaque-challenge',
            code_challenge_method: 'plain',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        }),
        toAuthorizeResponse({}),
      ),
    ).rejects.toThrow(/S256/);

    expect(handle).not.toHaveBeenCalled();
  });

  it('passes authorization_code grants through the wrapped token bridge when no refresh token is returned', async () => {
    const response = createExpressResponseStub();

    await expect(
      controller.token(
        toTokenRequest({
          body: {
            grant_type: 'authorization_code',
            client_id: 'internal-id-client',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        }),
        toTokenResponse(response),
      ),
    ).resolves.toBeUndefined();

    expect(handle).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(issueTokenForClient).not.toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(
      JSON.stringify({
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 900,
        id_token: buildIdToken('usr_123'),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.token.request.accepted',
        severity: AuditSeverity.INFO,
      }),
    );
  });

  it('replaces upstream refresh tokens with wrapped refresh tokens on authorization_code exchange', async () => {
    dispatch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          token_type: 'Bearer',
          expires_in: 900,
          id_token: buildIdToken('usr_123'),
          refresh_token: 'upstream-refresh-token',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
    issueTokenForClient.mockResolvedValueOnce({
      refreshToken: 'wrapped-refresh-token',
      tokenId: 'rtk_wrapped',
      familyId: 'rtf_wrapped',
      idleExpiresAt: new Date('2026-06-11T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-06-11T01:00:00.000Z'),
    });
    const response = createExpressResponseStub();

    await expect(
      controller.token(
        toTokenRequest({
          body: {
            grant_type: 'authorization_code',
            client_id: 'internal-id-client',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        }),
        toTokenResponse(response),
      ),
    ).resolves.toBeUndefined();

    expect(issueTokenForClient).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_123',
        clientIdentifier: 'internal-id-client',
        upstreamRefreshToken: 'upstream-refresh-token',
      }),
    );
    expect(response.send).toHaveBeenCalledWith(
      JSON.stringify({
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 900,
        id_token: buildIdToken('usr_123'),
        refresh_token: 'wrapped-refresh-token',
      }),
    );
  });

  it('translates wrapped refresh grants to upstream refresh grants and returns the rotated wrapper token', async () => {
    dispatch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'next-access-token',
          token_type: 'Bearer',
          expires_in: 900,
          refresh_token: 'next-upstream-refresh-token',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
    rotateToken.mockResolvedValueOnce({
      refreshToken: 'rotated-wrapper-refresh-token',
      tokenId: 'rtk_rotated',
      familyId: 'rtf_123',
      idleExpiresAt: new Date('2026-06-11T01:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-06-11T01:00:00.000Z'),
    });
    const response = createExpressResponseStub();

    await expect(
      controller.token(
        toTokenRequest({
          body: {
            grant_type: 'refresh_token',
            client_id: 'internal-id-client',
            refresh_token: 'wrapped-refresh-token',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          method: 'POST',
          originalUrl: '/api/auth/oauth2/token',
          url: '/api/auth/oauth2/token',
        }),
        toTokenResponse(response),
      ),
    ).resolves.toBeUndefined();

    expect(resolveRefreshGrant).toHaveBeenCalledWith('wrapped-refresh-token');
    expect(dispatch).toHaveBeenCalledTimes(1);
    const secondDispatchCall = dispatch.mock.calls[0];
    const dispatchOverrides = secondDispatchCall?.[1];
    expect(dispatchOverrides?.body).toMatchObject({
      refresh_token: 'upstream-refresh-token',
    });
    expect(rotateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: 'wrapped-refresh-token',
        upstreamRefreshToken: 'next-upstream-refresh-token',
      }),
    );
    expect(response.send).toHaveBeenCalledWith(
      JSON.stringify({
        access_token: 'next-access-token',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_token: 'rotated-wrapper-refresh-token',
      }),
    );
  });

  it('rejects unsupported token grants at the controller boundary', async () => {
    await expect(
      controller.token(
        toTokenRequest({
          body: {
            grant_type: 'client_credentials',
          },
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        }),
        toTokenResponse({}),
      ),
    ).rejects.toThrow(/authorization_code and refresh_token/);

    expect(handle).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'oidc.token.request.rejected',
        severity: AuditSeverity.WARNING,
      }),
    );
  });

  it('blocks dynamic registration routes before Better Auth sees them', async () => {
    await expect(
      controller.blockRegister(
        toRegisterRequest({
          body: {},
          ip: '127.0.0.1',
          get: vi.fn(() => 'test-agent'),
        }),
      ),
    ).rejects.toThrow(/Dynamic client registration/);

    expect(handle).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'client.registration.blocked',
        severity: AuditSeverity.WARNING,
      }),
    );
  });

  it('filters the public userinfo response through Internal ID claim policy', async () => {
    dispatch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sub: 'usr_123',
          email: 'admin@company.com',
          groups: ['identity-admins'],
          profile_type: 'employee',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
    filterUserInfoClaims.mockResolvedValueOnce({
      sub: 'usr_123',
      groups: ['identity-admins'],
    });
    const response = createExpressResponseStub();

    await expect(
      controller.userInfo(
        toUserInfoRequest({
          headers: {
            authorization: 'Bearer opaque-access-token',
          },
          method: 'GET',
          originalUrl: '/api/auth/oauth2/userinfo',
          url: '/api/auth/oauth2/userinfo',
        }),
        toUserInfoResponse(response),
      ),
    ).resolves.toBeUndefined();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(filterUserInfoClaims).toHaveBeenCalledWith(
      'Bearer opaque-access-token',
      expect.objectContaining({
        sub: 'usr_123',
        email: 'admin@company.com',
        groups: ['identity-admins'],
      }),
    );
    expect(response.send).toHaveBeenCalledWith(
      JSON.stringify({
        sub: 'usr_123',
        groups: ['identity-admins'],
      }),
    );
  });

  it('passes through non-OK userinfo responses without policy filtering', async () => {
    dispatch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_token',
        }),
        {
          status: 401,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
    const response = createExpressResponseStub();

    await expect(
      controller.userInfo(
        toUserInfoRequest({
          headers: {
            authorization: 'Bearer invalid-token',
          },
          method: 'GET',
          originalUrl: '/api/auth/oauth2/userinfo',
          url: '/api/auth/oauth2/userinfo',
        }),
        toUserInfoResponse(response),
      ),
    ).resolves.toBeUndefined();

    expect(filterUserInfoClaims).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    expect(response.send).toHaveBeenCalledWith(
      JSON.stringify({
        error: 'invalid_token',
      }),
    );
  });

  it('falls back to sub-only userinfo when no bearer token is available for policy lookup', async () => {
    dispatch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sub: 'usr_123',
          email: 'admin@company.com',
          groups: ['identity-admins'],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
    filterUserInfoClaims.mockResolvedValueOnce({
      sub: 'usr_123',
    });
    const response = createExpressResponseStub();

    await expect(
      controller.userInfo(
        toUserInfoRequest({
          headers: {},
          method: 'GET',
          originalUrl: '/api/auth/oauth2/userinfo',
          url: '/api/auth/oauth2/userinfo',
        }),
        toUserInfoResponse(response),
      ),
    ).resolves.toBeUndefined();

    expect(filterUserInfoClaims).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        sub: 'usr_123',
        email: 'admin@company.com',
      }),
    );
    expect(response.send).toHaveBeenCalledWith(
      JSON.stringify({
        sub: 'usr_123',
      }),
    );
  });
});

function createExpressResponseStub(): ExpressResponseStub {
  return {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

function toAuthorizeRequest(value: unknown): AuthorizeRequest {
  return value as AuthorizeRequest;
}

function toAuthorizeResponse(value: unknown): AuthorizeResponse {
  return value as AuthorizeResponse;
}

function toRegisterRequest(value: unknown): RegisterRequest {
  return value as RegisterRequest;
}

function toTokenRequest(value: unknown): TokenRequest {
  return value as TokenRequest;
}

function toTokenResponse(value: unknown): TokenResponse {
  return value as TokenResponse;
}

function toUserInfoRequest(value: unknown): UserInfoRequest {
  return value as UserInfoRequest;
}

function toUserInfoResponse(value: unknown): UserInfoResponse {
  return value as UserInfoResponse;
}

function buildIdToken(subject: string): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: subject })}.signature`;
}
