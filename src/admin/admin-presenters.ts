import { AuditEventEntity } from '../database/entities/audit-event.entity';
import { GroupEntity } from '../database/entities/group.entity';
import {
  OidcClientEntity,
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import { OidcRedirectUriEntity } from '../database/entities/oidc-redirect-uri.entity';
import {
  UserEntity,
  UserProfileType,
  UserStatus,
} from '../database/entities/user.entity';

// Presenters map internal entities to the hardened `/admin/api/*` contract
// documented in docs/ADMIN_API_CONTRACT.md. They deliberately return only the
// contract fields (never secret hashes or normalized/internal columns) and emit
// ISO-8601 strings for dates.

export interface UserSummaryDto {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  profileType: UserProfileType;
  status: UserStatus;
  createdAt: string;
}

export interface UserDetailDto extends UserSummaryDto {
  givenName: string | null;
  familyName: string | null;
  emailVerifiedAt: string | null;
  updatedAt: string;
  deactivatedAt: string | null;
  groups: Array<{ id: string; slug: string; displayName: string }>;
}

export interface GroupSummaryDto {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

export interface GroupMemberDto {
  id: string;
  displayName: string;
  email: string;
  status: UserStatus;
}

export interface GroupDetailDto extends GroupSummaryDto {
  updatedAt: string;
  members: GroupMemberDto[];
}

export interface ClientSummaryDto {
  id: string;
  clientId: string;
  name: string;
  type: OidcClientType;
  status: OidcClientStatus;
  ownerTeam: string | null;
  hasSecret: boolean;
  createdAt: string;
}

export interface ClientDetailDto extends ClientSummaryDto {
  allowedScopes: string[];
  allowedClaims: string[];
  requirePkce: boolean;
  allowRefreshTokens: boolean;
  accessTokenTtlSeconds: number;
  idTokenTtlSeconds: number;
  refreshTokenIdleTtlSeconds: number | null;
  refreshTokenAbsoluteTtlSeconds: number | null;
  updatedAt: string;
  redirectUris: Array<{ id: string; uri: string }>;
}

export interface AuditEventDto {
  id: string;
  eventType: string;
  severity: string;
  actorUserId: string | null;
  targetUserId: string | null;
  clientId: string | null;
  providerSessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toUserSummary(user: UserEntity): UserSummaryDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    profileType: user.profileType,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toUserDetail(
  user: UserEntity,
  groups: GroupEntity[],
): UserDetailDto {
  return {
    ...toUserSummary(user),
    givenName: user.givenName,
    familyName: user.familyName,
    emailVerifiedAt: iso(user.emailVerifiedAt),
    updatedAt: user.updatedAt.toISOString(),
    deactivatedAt: iso(user.deactivatedAt),
    groups: groups.map((group) => ({
      id: group.id,
      slug: group.slug,
      displayName: group.displayName,
    })),
  };
}

export function toGroupSummary(
  group: GroupEntity,
  memberCount: number,
): GroupSummaryDto {
  return {
    id: group.id,
    slug: group.slug,
    displayName: group.displayName,
    description: group.description,
    memberCount,
    createdAt: group.createdAt.toISOString(),
  };
}

export function toGroupDetail(
  group: GroupEntity,
  members: UserEntity[],
): GroupDetailDto {
  return {
    ...toGroupSummary(group, members.length),
    updatedAt: group.updatedAt.toISOString(),
    members: members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      email: member.email,
      status: member.status,
    })),
  };
}

export function toClientSummary(client: OidcClientEntity): ClientSummaryDto {
  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    type: client.type,
    status: client.status,
    ownerTeam: client.ownerTeam,
    hasSecret: client.clientSecretHash !== null,
    createdAt: client.createdAt.toISOString(),
  };
}

export function toClientDetail(
  client: OidcClientEntity,
  redirectUris: OidcRedirectUriEntity[],
): ClientDetailDto {
  return {
    ...toClientSummary(client),
    allowedScopes: client.allowedScopes,
    allowedClaims: client.allowedClaims,
    requirePkce: client.requirePkce,
    allowRefreshTokens: client.allowRefreshTokens,
    accessTokenTtlSeconds: client.accessTokenTtlSeconds,
    idTokenTtlSeconds: client.idTokenTtlSeconds,
    refreshTokenIdleTtlSeconds: client.refreshTokenIdleTtlSeconds,
    refreshTokenAbsoluteTtlSeconds: client.refreshTokenAbsoluteTtlSeconds,
    updatedAt: client.updatedAt.toISOString(),
    redirectUris: redirectUris.map((redirectUri) => ({
      id: redirectUri.id,
      uri: redirectUri.uri,
    })),
  };
}

export function toAuditEvent(event: AuditEventEntity): AuditEventDto {
  return {
    id: event.id,
    eventType: event.eventType,
    severity: event.severity,
    actorUserId: event.actorUserId,
    targetUserId: event.targetUserId,
    clientId: event.clientId,
    providerSessionId: event.providerSessionId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    metadata: event.metadataJson ?? {},
    createdAt: event.createdAt.toISOString(),
  };
}
