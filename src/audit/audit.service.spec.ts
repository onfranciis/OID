import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';

describe('AuditService', () => {
  const createAuditEvent = vi.fn((input: unknown) => input);
  const saveAuditEvent = vi.fn(() => Promise.resolve());
  const service = new AuditService({
    create: createAuditEvent,
    save: saveAuditEvent,
  } as never);

  beforeEach(() => {
    createAuditEvent.mockClear();
    saveAuditEvent.mockClear();
  });

  it('persists audit events and returns the generated event ID', async () => {
    const eventId = await service.record({
      eventType: 'admin.user.created',
      severity: AuditSeverity.INFO,
      actorUserId: 'usr_admin',
      targetUserId: 'usr_target',
      clientId: 'cli_target',
      providerSessionId: 'psn_admin',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      metadata: {
        normalizedEmail: 'admin@company.com',
      },
    });

    expect(eventId).toMatch(/^evt_/);
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: eventId,
        eventType: 'admin.user.created',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_admin',
        targetUserId: 'usr_target',
        clientId: 'cli_target',
        providerSessionId: 'psn_admin',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
        metadataJson: {
          normalizedEmail: 'admin@company.com',
        },
      }),
    );
    expect(saveAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: eventId,
      }),
    );
  });

  it('normalizes omitted nullable fields to null', async () => {
    await service.record({
      eventType: 'user.login.rejected',
      severity: AuditSeverity.WARNING,
    });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        targetUserId: null,
        clientId: null,
        providerSessionId: null,
        ipAddress: null,
        userAgent: null,
        metadataJson: null,
      }),
    );
  });

  it('redacts sensitive metadata before persistence', async () => {
    await service.record({
      eventType: 'oidc.token.issued',
      severity: AuditSeverity.INFO,
      metadata: {
        tokenId: 'rtk_123',
        refreshToken: 'raw-refresh-token',
        password: 'raw-password',
        nested: {
          authorizationHeader: 'Bearer raw-token',
          safeValue: 'kept',
        },
        attempts: [
          {
            codeVerifier: 'raw-verifier',
            clientId: 'cli_public',
          },
        ],
      },
    });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadataJson: {
          tokenId: '[REDACTED]',
          refreshToken: '[REDACTED]',
          password: '[REDACTED]',
          nested: {
            authorizationHeader: '[REDACTED]',
            safeValue: 'kept',
          },
          attempts: [
            {
              codeVerifier: '[REDACTED]',
              clientId: 'cli_public',
            },
          ],
        },
      }),
    );
  });
});
