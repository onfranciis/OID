import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuditService } from './admin-audit.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';

describe('AdminAuditService', () => {
  const findAuditEvents = vi.fn();
  const service = new AdminAuditService({
    find: findAuditEvents,
  } as never);

  beforeEach(() => {
    findAuditEvents.mockReset();
    findAuditEvents.mockResolvedValue([]);
  });

  it('lists recent audit events with the default limit', async () => {
    await service.listRecent({});

    expect(findAuditEvents).toHaveBeenCalledWith({
      where: {},
      order: {
        createdAt: 'DESC',
      },
      take: 50,
    });
  });

  it('applies supported filters and caps the limit', async () => {
    await service.listRecent({
      limit: '500',
      eventType: 'admin.user.created',
      severity: AuditSeverity.INFO,
      actorUserId: ' usr_admin ',
      targetUserId: 'usr_target',
      clientId: 'cli_target',
    });

    expect(findAuditEvents).toHaveBeenCalledWith({
      where: {
        eventType: 'admin.user.created',
        severity: AuditSeverity.INFO,
        actorUserId: 'usr_admin',
        targetUserId: 'usr_target',
        clientId: 'cli_target',
      },
      order: {
        createdAt: 'DESC',
      },
      take: 200,
    });
  });

  it('rejects invalid limit and severity values', async () => {
    await expect(
      service.listRecent({
        limit: 'zero',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.listRecent({
        severity: 'debug' as AuditSeverity,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(findAuditEvents).not.toHaveBeenCalled();
  });

  it('rejects blank filters', async () => {
    await expect(
      service.listRecent({
        eventType: ' ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(findAuditEvents).not.toHaveBeenCalled();
  });
});
