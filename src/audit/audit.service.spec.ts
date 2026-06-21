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
});
