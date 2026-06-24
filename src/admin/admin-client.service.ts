import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { monotonicFactory } from 'ulid';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes, type AuditEventType } from '../audit/audit.types';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  OidcClientEntity,
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import type { AdminMutationContext } from './admin-user.service';

const nextUlid = monotonicFactory();
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_ID_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_IDLE_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS = 60 * 60 * 24 * 30;

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

export interface AdminCreateClientInput {
  clientId: string;
  name: string;
  type?: OidcClientType;
  allowedScopes?: string[];
  allowedClaims?: string[];
  requirePkce?: boolean;
  allowRefreshTokens?: boolean;
  accessTokenTtlSeconds?: number;
  idTokenTtlSeconds?: number;
  refreshTokenIdleTtlSeconds?: number | null;
  refreshTokenAbsoluteTtlSeconds?: number | null;
  ownerTeam?: string | null;
}

export interface AdminUpdateClientInput {
  name?: string;
  allowedScopes?: string[];
  allowedClaims?: string[];
  requirePkce?: boolean;
  allowRefreshTokens?: boolean;
  accessTokenTtlSeconds?: number;
  idTokenTtlSeconds?: number;
  refreshTokenIdleTtlSeconds?: number | null;
  refreshTokenAbsoluteTtlSeconds?: number | null;
  ownerTeam?: string | null;
}

export interface AdminRedirectUriInput {
  uri: string;
}

export interface AdminRotateClientSecretResult {
  clientId: string;
  clientSecret: string;
}

@Injectable()
export class AdminClientService {
  constructor(
    @InjectRepository(OidcClientEntity)
    private readonly clientRepository: Repository<OidcClientEntity>,
    @InjectRepository(OidcRedirectUriEntity)
    private readonly redirectUriRepository: Repository<OidcRedirectUriEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createClient(
    input: AdminCreateClientInput,
    context: AdminMutationContext,
  ): Promise<OidcClientEntity> {
    const clientId = normalizeRequired(input.clientId, 'clientId');
    await this.assertClientIdAvailable(clientId);

    const allowRefreshTokens = input.allowRefreshTokens ?? false;
    const client = this.clientRepository.create({
      id: prefixedUlid('cli'),
      clientId,
      clientSecretHash: null,
      name: normalizeRequired(input.name, 'name'),
      type: input.type ?? OidcClientType.CONFIDENTIAL,
      status: OidcClientStatus.ACTIVE,
      allowedScopes: normalizeStringList(input.allowedScopes, ['openid']),
      allowedClaims: normalizeStringList(input.allowedClaims, ['sub']),
      requirePkce: input.requirePkce ?? true,
      accessTokenTtlSeconds: normalizePositiveInteger(
        input.accessTokenTtlSeconds,
        'accessTokenTtlSeconds',
        DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
      ),
      idTokenTtlSeconds: normalizePositiveInteger(
        input.idTokenTtlSeconds,
        'idTokenTtlSeconds',
        DEFAULT_ID_TOKEN_TTL_SECONDS,
      ),
      ...buildRefreshTokenPolicy(input, allowRefreshTokens),
      ownerTeam: normalizeOptional(input.ownerTeam),
    });
    const savedClient = await this.clientRepository.save(client);

    await this.auditClientMutation(
      AuditEventTypes.AdminClientCreated,
      savedClient,
      context,
      {
        clientId: savedClient.clientId,
        type: savedClient.type,
        status: savedClient.status,
      },
    );

    return savedClient;
  }

  async updateClient(
    clientRecordId: string,
    input: AdminUpdateClientInput,
    context: AdminMutationContext,
  ): Promise<OidcClientEntity> {
    const client = await this.getExistingClient(clientRecordId);

    if (input.name !== undefined) {
      client.name = normalizeRequired(input.name, 'name');
    }

    if (input.allowedScopes !== undefined) {
      client.allowedScopes = normalizeStringList(input.allowedScopes, [
        'openid',
      ]);
    }

    if (input.allowedClaims !== undefined) {
      client.allowedClaims = normalizeStringList(input.allowedClaims, ['sub']);
    }

    if (input.requirePkce !== undefined) {
      client.requirePkce = input.requirePkce;
    }

    if (input.accessTokenTtlSeconds !== undefined) {
      client.accessTokenTtlSeconds = normalizePositiveInteger(
        input.accessTokenTtlSeconds,
        'accessTokenTtlSeconds',
      );
    }

    if (input.idTokenTtlSeconds !== undefined) {
      client.idTokenTtlSeconds = normalizePositiveInteger(
        input.idTokenTtlSeconds,
        'idTokenTtlSeconds',
      );
    }

    if (input.ownerTeam !== undefined) {
      client.ownerTeam = normalizeOptional(input.ownerTeam);
    }

    if (
      input.allowRefreshTokens !== undefined ||
      input.refreshTokenIdleTtlSeconds !== undefined ||
      input.refreshTokenAbsoluteTtlSeconds !== undefined
    ) {
      const allowRefreshTokens =
        input.allowRefreshTokens ?? client.allowRefreshTokens;
      client.allowRefreshTokens = allowRefreshTokens;
      Object.assign(
        client,
        buildRefreshTokenPolicy(
          {
            refreshTokenIdleTtlSeconds:
              input.refreshTokenIdleTtlSeconds ??
              client.refreshTokenIdleTtlSeconds,
            refreshTokenAbsoluteTtlSeconds:
              input.refreshTokenAbsoluteTtlSeconds ??
              client.refreshTokenAbsoluteTtlSeconds,
          },
          allowRefreshTokens,
        ),
      );
    }

    const savedClient = await this.clientRepository.save(client);

    await this.auditClientMutation(
      AuditEventTypes.AdminClientUpdated,
      savedClient,
      context,
      {
        clientId: savedClient.clientId,
        allowedScopes: savedClient.allowedScopes,
        allowedClaims: savedClient.allowedClaims,
        allowRefreshTokens: savedClient.allowRefreshTokens,
      },
    );

    return savedClient;
  }

  async setClientStatus(
    clientRecordId: string,
    status: OidcClientStatus,
    context: AdminMutationContext,
  ): Promise<OidcClientEntity> {
    if (!Object.values(OidcClientStatus).includes(status)) {
      throw new BadRequestException('Unsupported client status.');
    }

    const client = await this.getExistingClient(clientRecordId);
    client.status = status;

    const savedClient = await this.clientRepository.save(client);

    await this.auditClientMutation(
      AuditEventTypes.AdminClientStatusChanged,
      savedClient,
      context,
      {
        clientId: savedClient.clientId,
        status: savedClient.status,
      },
    );

    return savedClient;
  }

  async rotateClientSecret(
    clientRecordId: string,
    context: AdminMutationContext,
  ): Promise<AdminRotateClientSecretResult> {
    const client = await this.getExistingClient(clientRecordId);

    if (client.type !== OidcClientType.CONFIDENTIAL) {
      throw new BadRequestException(
        'Only confidential clients can have client secrets.',
      );
    }

    const clientSecret = generateClientSecret();
    client.clientSecretHash = hashSecret(clientSecret);

    const savedClient = await this.clientRepository.save(client);

    await this.auditClientMutation(
      AuditEventTypes.ClientSecretRotated,
      savedClient,
      context,
      {
        clientId: savedClient.clientId,
      },
      AuditSeverity.WARNING,
    );

    return {
      clientId: savedClient.clientId,
      clientSecret,
    };
  }

  async addRedirectUri(
    clientRecordId: string,
    input: AdminRedirectUriInput,
    context: AdminMutationContext,
  ): Promise<OidcRedirectUriEntity> {
    const client = await this.getExistingClient(clientRecordId);
    const uri = normalizeRedirectUri(input.uri);

    const existingRedirectUri = await this.redirectUriRepository.findOne({
      where: {
        clientId: client.id,
        uri,
      },
    });

    if (existingRedirectUri) {
      throw new ConflictException('Redirect URI is already registered.');
    }

    const redirectUri = this.redirectUriRepository.create({
      id: prefixedUlid('rdu'),
      clientId: client.id,
      uri,
    });
    const savedRedirectUri = await this.redirectUriRepository.save(redirectUri);

    await this.auditClientMutation(
      AuditEventTypes.AdminClientRedirectUriAdded,
      client,
      context,
      {
        clientId: client.clientId,
        redirectUriId: savedRedirectUri.id,
        uri: savedRedirectUri.uri,
      },
    );

    return savedRedirectUri;
  }

  async removeRedirectUri(
    clientRecordId: string,
    redirectUriId: string,
    context: AdminMutationContext,
  ): Promise<void> {
    const client = await this.getExistingClient(clientRecordId);
    const redirectUri = await this.redirectUriRepository.findOne({
      where: {
        id: redirectUriId,
        clientId: client.id,
      },
    });

    if (!redirectUri) {
      throw new NotFoundException('Redirect URI not found.');
    }

    await this.redirectUriRepository.remove(redirectUri);
    await this.auditClientMutation(
      AuditEventTypes.AdminClientRedirectUriRemoved,
      client,
      context,
      {
        clientId: client.clientId,
        redirectUriId,
        uri: redirectUri.uri,
      },
    );
  }

  private async getExistingClient(
    clientRecordId: string,
  ): Promise<OidcClientEntity> {
    const client = await this.clientRepository.findOne({
      where: {
        id: clientRecordId,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  private async assertClientIdAvailable(clientId: string): Promise<void> {
    const existingClient = await this.clientRepository.findOne({
      where: {
        clientId,
      },
    });

    if (existingClient) {
      throw new ConflictException('Client ID is already in use.');
    }
  }

  private auditClientMutation(
    eventType: AuditEventType,
    client: OidcClientEntity,
    context: AdminMutationContext,
    metadata: Record<string, unknown>,
    severity: AuditSeverity = AuditSeverity.INFO,
  ): Promise<string> {
    return this.auditService.record({
      eventType,
      severity,
      actorUserId: context.principal.user.id,
      clientId: client.id,
      providerSessionId: context.principal.providerSession.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata,
    });
  }
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return normalizedValue;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeStringList(
  values: string[] | undefined,
  defaultValues: string[],
): string[] {
  const sourceValues = values ?? defaultValues;
  const normalizedValues = sourceValues
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (normalizedValues.length === 0) {
    throw new BadRequestException('At least one value is required.');
  }

  return [...new Set(normalizedValues)];
}

function normalizePositiveInteger(
  value: number | undefined | null,
  fieldName: string,
  defaultValue?: number,
): number {
  const normalizedValue = value ?? defaultValue;

  if (
    normalizedValue === undefined ||
    !Number.isInteger(normalizedValue) ||
    normalizedValue <= 0
  ) {
    throw new BadRequestException(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
}

function buildRefreshTokenPolicy(
  input: Pick<
    AdminCreateClientInput | AdminUpdateClientInput,
    'refreshTokenIdleTtlSeconds' | 'refreshTokenAbsoluteTtlSeconds'
  >,
  allowRefreshTokens: boolean,
) {
  if (!allowRefreshTokens) {
    return {
      allowRefreshTokens,
      refreshTokenIdleTtlSeconds: null,
      refreshTokenAbsoluteTtlSeconds: null,
    };
  }

  return {
    allowRefreshTokens,
    refreshTokenIdleTtlSeconds: normalizePositiveInteger(
      input.refreshTokenIdleTtlSeconds,
      'refreshTokenIdleTtlSeconds',
      DEFAULT_REFRESH_TOKEN_IDLE_TTL_SECONDS,
    ),
    refreshTokenAbsoluteTtlSeconds: normalizePositiveInteger(
      input.refreshTokenAbsoluteTtlSeconds,
      'refreshTokenAbsoluteTtlSeconds',
      DEFAULT_REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS,
    ),
  };
}

function normalizeRedirectUri(uri: string): string {
  const normalizedUri = normalizeRequired(uri, 'uri');

  let parsedUri: URL;
  try {
    parsedUri = new URL(normalizedUri);
  } catch {
    throw new BadRequestException('Redirect URI must be an absolute URL.');
  }

  if (parsedUri.protocol !== 'https:' && parsedUri.protocol !== 'http:') {
    throw new BadRequestException('Redirect URI must use http or https.');
  }

  if (parsedUri.hash.length > 0) {
    throw new BadRequestException('Redirect URI must not include a fragment.');
  }

  return normalizedUri;
}

function generateClientSecret(): string {
  return `oidc_secret_${randomBytes(32).toString('base64url')}`;
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
