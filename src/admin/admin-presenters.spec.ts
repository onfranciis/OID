import { describe, expect, it } from 'vitest';
import { AuditEventEntity } from '../database/entities/audit-event.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { UserEntity } from '../database/entities/user.entity';
import {
  toAuditEvent,
  toClientSummary,
  toUserDetail,
} from './admin-presenters';

const CREATED = new Date('2026-01-02T03:04:05.000Z');

function user(): UserEntity {
  return {
    id: 'usr_1',
    email: 'a@company.com',
    normalizedEmail: 'a@company.com',
    username: 'ann',
    normalizedUsername: 'ann',
    displayName: 'Ann',
    givenName: 'Ann',
    familyName: 'Ng',
    emailVerifiedAt: null,
    profileType: 'employee',
    status: 'active',
    createdAt: CREATED,
    updatedAt: CREATED,
    deactivatedAt: null,
  } as unknown as UserEntity;
}

describe('admin presenters', () => {
  it('maps user detail with groups and ISO dates, omitting internal columns', () => {
    const dto = toUserDetail(user(), [
      { id: 'grp_1', slug: 'eng', displayName: 'Engineering' } as never,
    ]);

    expect(dto.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(dto.groups).toEqual([
      { id: 'grp_1', slug: 'eng', displayName: 'Engineering' },
    ]);
    // Normalized/internal columns must not leak into the contract shape.
    expect(dto).not.toHaveProperty('normalizedEmail');
    expect(dto).not.toHaveProperty('normalizedUsername');
  });

  it('derives hasSecret and never exposes the secret hash', () => {
    const dto = toClientSummary({
      id: 'cli_1',
      clientId: 'web',
      name: 'Web',
      type: 'confidential',
      status: 'active',
      ownerTeam: null,
      clientSecretHash: 'secret-hash',
      createdAt: CREATED,
    } as unknown as OidcClientEntity);

    expect(dto.hasSecret).toBe(true);
    expect(dto).not.toHaveProperty('clientSecretHash');
  });

  it('renames metadataJson to metadata and defaults null to {}', () => {
    const withMeta = toAuditEvent({
      id: 'aud_1',
      eventType: 'admin.user.created',
      severity: 'info',
      actorUserId: 'usr_admin',
      targetUserId: 'usr_1',
      clientId: null,
      providerSessionId: null,
      ipAddress: null,
      userAgent: null,
      metadataJson: { status: 'pending' },
      createdAt: CREATED,
    } as unknown as AuditEventEntity);

    expect(withMeta.metadata).toEqual({ status: 'pending' });

    const withoutMeta = toAuditEvent({
      id: 'aud_2',
      eventType: 'x',
      severity: 'info',
      actorUserId: null,
      targetUserId: null,
      clientId: null,
      providerSessionId: null,
      ipAddress: null,
      userAgent: null,
      metadataJson: null,
      createdAt: CREATED,
    } as unknown as AuditEventEntity);

    expect(withoutMeta.metadata).toEqual({});
    expect(withoutMeta).not.toHaveProperty('metadataJson');
  });
});
