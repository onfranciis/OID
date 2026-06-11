import { All, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { BetterAuthService } from './better-auth.service';
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
  ) {}

  @Get('oauth2/authorize')
  async authorize(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      assertSupportedAuthorizationRequest(req.query);
    } catch (error) {
      await this.recordAuditEvent(
        'oidc.authorize.request.rejected',
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
      'oidc.authorize.request.accepted',
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
  async token(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      assertSupportedTokenRequest(req.body);
    } catch (error) {
      await this.recordAuditEvent(
        'oidc.token.request.rejected',
        AuditSeverity.WARNING,
        req,
        {
          grantType: getBodyValue(req.body, 'grant_type'),
          clientId: getBodyValue(req.body, 'client_id'),
        },
      );
      throw error;
    }

    await this.betterAuthService.handle(req, res);
    await this.recordAuditEvent(
      'oidc.token.request.accepted',
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
      'client.registration.blocked',
      AuditSeverity.WARNING,
      req,
      {
        clientId: getBodyValue(req.body, 'client_id'),
      },
    );

    return blockDynamicClientRegistration();
  }

  @All()
  async handleRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }

  @All('*path')
  async handleNested(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }

  private recordAuditEvent(
    eventType: string,
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
