import { All, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response as ExpressResponse } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes, type AuditEventType } from '../audit/audit.types';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { RefreshTokenService } from '../tokens/refresh-token.service';
import { BetterAuthService } from './better-auth.service';
import { UserInfoPolicyService } from './userinfo-policy.service';
import {
  assertSupportedAuthorizationRequest,
  assertSupportedTokenRequest,
  blockDynamicClientRegistration,
} from './better-auth.guardrails';

@Controller('api/auth')
export class BetterAuthController {
  constructor(
    private readonly betterAuthService: BetterAuthService,
    private readonly auditService: AuditService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly userInfoPolicyService: UserInfoPolicyService,
  ) {}

  @Get('oauth2/authorize')
  async authorize(
    @Req() req: Request,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    try {
      assertSupportedAuthorizationRequest(req.query);
    } catch (error) {
      await this.recordAuditEvent(
        AuditEventTypes.OidcAuthorizeRequestRejected,
        AuditSeverity.WARNING,
        req,
        {
          responseType: getSingleValue(req.query.response_type),
          clientId: getSingleValue(req.query.client_id),
        },
      );
      throw error;
    }

    await this.betterAuthService.handle(req, res);
    await this.recordAuditEvent(
      AuditEventTypes.OidcAuthorizeRequestAccepted,
      AuditSeverity.INFO,
      req,
      {
        responseType: getSingleValue(req.query.response_type),
        clientId: getSingleValue(req.query.client_id),
        responseStatusCode: res.statusCode,
      },
    );
  }

  @Post('oauth2/token')
  async token(@Req() req: Request, @Res() res: ExpressResponse): Promise<void> {
    const grantType = getBodyValue(req.body, 'grant_type');

    try {
      assertSupportedTokenRequest(req.body);
    } catch (error) {
      await this.recordAuditEvent(
        AuditEventTypes.OidcTokenRequestRejected,
        AuditSeverity.WARNING,
        req,
        {
          grantType: getBodyValue(req.body, 'grant_type'),
          clientId: getBodyValue(req.body, 'client_id'),
        },
      );
      throw error;
    }

    const response =
      grantType === 'refresh_token'
        ? await this.handleWrappedRefreshGrant(req)
        : await this.handleTokenExchange(req);

    await sendFetchResponse(res, response);
    await this.recordAuditEvent(
      AuditEventTypes.OidcTokenRequestAccepted,
      AuditSeverity.INFO,
      req,
      {
        grantType: getBodyValue(req.body, 'grant_type'),
        clientId: getBodyValue(req.body, 'client_id'),
        responseStatusCode: res.statusCode,
      },
    );
  }

  @All('oauth2/register')
  async blockRegister(@Req() req: Request): Promise<never> {
    await this.recordAuditEvent(
      AuditEventTypes.ClientRegistrationBlocked,
      AuditSeverity.WARNING,
      req,
      {
        clientId: getBodyValue(req.body, 'client_id'),
      },
    );

    return blockDynamicClientRegistration();
  }

  @Get('oauth2/userinfo')
  async userInfo(
    @Req() req: Request,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const response = await this.betterAuthService.dispatch(req);

    if (!response.ok) {
      await sendFetchResponse(res, response);
      return;
    }

    const payload = await readJsonBody(response);
    const filteredPayload =
      await this.userInfoPolicyService.filterUserInfoClaims(
        getHeaderValue(req.headers.authorization),
        payload,
      );

    await sendFetchResponse(
      res,
      rebuildJsonResponse(filteredPayload, response),
    );
  }

  @All()
  async handleRoot(
    @Req() req: Request,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }

  @All('*path')
  async handleNested(
    @Req() req: Request,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }

  private recordAuditEvent(
    eventType: AuditEventType,
    severity: AuditSeverity,
    req: Request,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    return this.auditService.record({
      eventType,
      severity,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      metadata,
    });
  }

  private async handleTokenExchange(
    req: Request,
  ): Promise<globalThis.Response> {
    const response = await this.betterAuthService.dispatch(req);

    if (!response.ok) {
      return response;
    }

    const payload = await readJsonBody(response);
    const upstreamRefreshToken =
      typeof payload.refresh_token === 'string' ? payload.refresh_token : null;
    const idToken =
      typeof payload.id_token === 'string' ? payload.id_token : null;
    const clientIdentifier = getBodyValue(req.body, 'client_id');
    const userId = idToken ? extractJwtSubject(idToken) : null;

    if (!upstreamRefreshToken || !clientIdentifier || !userId) {
      return rebuildJsonResponse(payload, response);
    }

    const wrappedToken = await this.refreshTokenService.issueTokenForClient({
      userId,
      clientIdentifier,
      upstreamRefreshToken,
    });

    if (!wrappedToken) {
      delete payload.refresh_token;
      return rebuildJsonResponse(payload, response);
    }

    payload.refresh_token = wrappedToken.refreshToken;
    return rebuildJsonResponse(payload, response);
  }

  private async handleWrappedRefreshGrant(
    req: Request,
  ): Promise<globalThis.Response> {
    const wrapperRefreshToken = getBodyValue(req.body, 'refresh_token');

    if (!wrapperRefreshToken) {
      return this.betterAuthService.dispatch(req);
    }

    const resolvedGrant =
      await this.refreshTokenService.resolveRefreshGrant(wrapperRefreshToken);
    const upstreamResponse = await this.betterAuthService.dispatch(req, {
      body: {
        ...(req.body as Record<string, unknown>),
        refresh_token: resolvedGrant.upstreamRefreshToken,
      },
    });

    if (!upstreamResponse.ok) {
      return upstreamResponse;
    }

    const payload = await readJsonBody(upstreamResponse);
    const nextUpstreamRefreshToken =
      typeof payload.refresh_token === 'string' ? payload.refresh_token : null;

    if (!nextUpstreamRefreshToken) {
      return rebuildJsonResponse(payload, upstreamResponse);
    }

    const rotatedToken = await this.refreshTokenService.rotateToken({
      refreshToken: wrapperRefreshToken,
      idleTtlSeconds: getTtlSecondsFromDelta(payload.expires_in, 604800),
      absoluteTtlSeconds: getTtlSecondsFromDelta(payload.expires_in, 604800),
      upstreamRefreshToken: nextUpstreamRefreshToken,
    });

    payload.refresh_token = rotatedToken.refreshToken;
    return rebuildJsonResponse(payload, upstreamResponse);
  }
}

function getSingleValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return null;
}

function getBodyValue(body: unknown, key: string): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  return getSingleValue((body as Record<string, unknown>)[key]);
}

function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return Array.isArray(value) && typeof value[0] === 'string'
    ? value[0]
    : undefined;
}

async function sendFetchResponse(
  res: ExpressResponse,
  response: globalThis.Response,
): Promise<void> {
  res.status(response.status);

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }

    res.setHeader(key, value);
  });

  const setCookieValues =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

  if (setCookieValues.length > 0) {
    res.setHeader('set-cookie', setCookieValues);
  }

  const bodyText = await response.text();
  res.send(bodyText);
}

async function readJsonBody(
  response: globalThis.Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function rebuildJsonResponse(
  payload: Record<string, unknown>,
  response: globalThis.Response,
): globalThis.Response {
  const headers = new Headers(response.headers);
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function extractJwtSubject(token: string): string | null {
  const parts = token.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'),
    ) as { sub?: unknown };

    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function getTtlSecondsFromDelta(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}
