import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { monotonicFactory } from 'ulid';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  OidcAuthorizationCodeEntity,
  PkceChallengeMethod,
} from '../database/entities/oidc-authorization-code.entity';
import {
  OidcClientEntity,
  OidcClientStatus,
} from '../database/entities/oidc-client.entity';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';

const AUTHORIZATION_CODE_TTL_SECONDS = 300;
const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

export interface AuthorizeRequestInput {
  responseType?: string;
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
  prompt?: string;
  providerSessionToken?: string | null;
  originalUrl: string;
  ipAddress: string | null;
  userAgent: string | null;
  now?: Date;
}

export interface AuthorizeRedirectResult {
  redirectTo: string;
}

@Injectable()
export class OidcAuthorizationService {
  private readonly loginPath: string;

  constructor(
    configService: AppConfigService,
    @InjectRepository(OidcClientEntity)
    private readonly clientRepository: Repository<OidcClientEntity>,
    @InjectRepository(OidcRedirectUriEntity)
    private readonly redirectUriRepository: Repository<OidcRedirectUriEntity>,
    @InjectRepository(OidcProviderSessionEntity)
    private readonly providerSessionRepository: Repository<OidcProviderSessionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(OidcAuthorizationCodeEntity)
    private readonly authorizationCodeRepository: Repository<OidcAuthorizationCodeEntity>,
    private readonly auditService: AuditService,
  ) {
    this.loginPath = configService.get('betterAuth.loginPath');
  }

  async authorize(
    input: AuthorizeRequestInput,
  ): Promise<AuthorizeRedirectResult> {
    const now = input.now ?? new Date();
    assertResponseType(input.responseType);
    const state = normalizeRequired(input.state, 'state');
    const clientIdentifier = normalizeRequired(input.clientId, 'client_id');
    const redirectUri = normalizeRequired(input.redirectUri, 'redirect_uri');
    const codeChallenge = normalizeRequired(
      input.codeChallenge,
      'code_challenge',
    );
    assertS256(input.codeChallengeMethod);
    const promptValues = parsePrompt(input.prompt);
    const client = await this.getActiveClient(clientIdentifier);
    await this.assertRedirectUriRegistered(client.id, redirectUri);
    const scope = validateScopes(input.scope, client.allowedScopes);

    if (promptValues.has('none') && promptValues.has('login')) {
      throw new BadRequestException(
        'prompt cannot include both none and login.',
      );
    }

    if (promptValues.has('login')) {
      return {
        redirectTo: this.buildLoginRedirect(input.originalUrl, {
          removePrompt: true,
        }),
      };
    }

    const session = await this.resolveProviderSession(
      input.providerSessionToken,
      now,
    );

    if (!session) {
      if (promptValues.has('none')) {
        return {
          redirectTo: buildErrorRedirect(redirectUri, {
            error: 'login_required',
            state,
          }),
        };
      }

      return {
        redirectTo: this.buildLoginRedirect(input.originalUrl),
      };
    }

    const user = await this.userRepository.findOne({
      where: {
        id: session.userId,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      if (promptValues.has('none')) {
        return {
          redirectTo: buildErrorRedirect(redirectUri, {
            error: 'login_required',
            state,
          }),
        };
      }

      throw new UnauthorizedException('Active user session required.');
    }

    session.lastSeenAt = now;
    await this.providerSessionRepository.save(session);

    const rawCode = randomBytes(32).toString('base64url');
    const authorizationCode = this.authorizationCodeRepository.create({
      id: prefixedUlid('cod'),
      codeHash: hashSecret(rawCode),
      clientId: client.id,
      userId: user.id,
      providerSessionId: session.id,
      redirectUri,
      scope,
      codeChallenge,
      codeChallengeMethod: PkceChallengeMethod.S256,
      nonce: normalizeOptional(input.nonce),
      authTime: session.authTime,
      expiresAt: new Date(
        now.getTime() + AUTHORIZATION_CODE_TTL_SECONDS * 1000,
      ),
      consumedAt: null,
    });
    const savedCode =
      await this.authorizationCodeRepository.save(authorizationCode);

    await this.auditService.record({
      eventType: AuditEventTypes.OidcAuthorizationCodeIssued,
      severity: AuditSeverity.INFO,
      actorUserId: user.id,
      targetUserId: user.id,
      clientId: client.id,
      providerSessionId: session.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        authorizationCodeId: savedCode.id,
        clientIdentifier: client.clientId,
        redirectUri,
        scope,
        expiresAt: savedCode.expiresAt.toISOString(),
      },
    });

    return {
      redirectTo: buildSuccessRedirect(redirectUri, {
        code: rawCode,
        state,
      }),
    };
  }

  private async getActiveClient(
    clientIdentifier: string,
  ): Promise<OidcClientEntity> {
    const client = await this.clientRepository.findOne({
      where: {
        clientId: clientIdentifier,
      },
    });

    if (!client || client.status !== OidcClientStatus.ACTIVE) {
      throw new BadRequestException('Unknown or disabled client.');
    }

    return client;
  }

  private async assertRedirectUriRegistered(
    clientId: string,
    redirectUri: string,
  ): Promise<void> {
    const registeredRedirectUri = await this.redirectUriRepository.findOne({
      where: {
        clientId,
        uri: redirectUri,
      },
    });

    if (!registeredRedirectUri) {
      throw new BadRequestException('redirect_uri is not registered.');
    }
  }

  private async resolveProviderSession(
    token: string | null | undefined,
    now: Date,
  ): Promise<OidcProviderSessionEntity | null> {
    if (!token) {
      return null;
    }

    const session = await this.providerSessionRepository.findOne({
      where: {
        sessionHash: hashSecret(token),
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.idleExpiresAt <= now ||
      session.absoluteExpiresAt <= now
    ) {
      return null;
    }

    return session;
  }

  private buildLoginRedirect(
    originalUrl: string,
    options?: { removePrompt?: boolean },
  ): string {
    const returnTo = options?.removePrompt
      ? removePromptFromOriginalUrl(originalUrl)
      : originalUrl;
    const searchParams = new URLSearchParams({
      returnTo,
    });

    return `${this.loginPath}?${searchParams.toString()}`;
  }
}

function assertResponseType(responseType: string | undefined): void {
  if (responseType !== 'code') {
    throw new BadRequestException('Only response_type=code is supported.');
  }
}

function assertS256(codeChallengeMethod: string | undefined): void {
  if (codeChallengeMethod !== PkceChallengeMethod.S256) {
    throw new BadRequestException(
      'Only code_challenge_method=S256 is supported.',
    );
  }
}

function normalizeRequired(
  value: string | undefined,
  fieldName: string,
): string {
  const normalizedValue = value?.trim() ?? '';

  if (normalizedValue.length === 0) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return normalizedValue;
}

function normalizeOptional(value: string | undefined): string | null {
  const normalizedValue = value?.trim() ?? '';

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parsePrompt(prompt: string | undefined): Set<string> {
  return new Set(
    (prompt ?? '')
      .split(' ')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function validateScopes(
  requestedScope: string | undefined,
  allowedScopes: string[],
): string {
  const scopes = (requestedScope ?? '')
    .split(' ')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  if (!scopes.includes('openid')) {
    throw new BadRequestException('openid scope is required.');
  }

  const disallowedScope = scopes.find(
    (scope) => !allowedScopes.includes(scope),
  );

  if (disallowedScope) {
    throw new BadRequestException(`Scope is not allowed: ${disallowedScope}.`);
  }

  return [...new Set(scopes)].join(' ');
}

function buildSuccessRedirect(
  redirectUri: string,
  params: { code: string; state: string },
): string {
  return buildRedirect(redirectUri, params);
}

function buildErrorRedirect(
  redirectUri: string,
  params: { error: string; state: string },
): string {
  return buildRedirect(redirectUri, params);
}

function buildRedirect(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(redirectUri);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function removePromptFromOriginalUrl(originalUrl: string): string {
  const url = new URL(originalUrl, 'http://internal-id.local');
  url.searchParams.delete('prompt');

  return `${url.pathname}${url.search}`;
}
