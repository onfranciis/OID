import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuditService } from './admin-audit.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';

// Mocks the fluent TypeORM query builder enough to assert calls and control
// getMany()'s result. andWhere calls go in a plain array instead of relying on
// the mock's own `.mock.calls`, to avoid circular typing on `stub` itself.
function createQueryBuilderStub() {
  const andWhereCalls: unknown[][] = [];
  const stub = {
    orderBy: vi.fn(() => stub),
    take: vi.fn(() => stub),
    andWhere: vi.fn((...args: unknown[]) => {
      andWhereCalls.push(args);

      return stub;
    }),
    andWhereCalls,
    getMany: vi.fn(() => Promise.resolve([] as unknown[])),
  };

  return stub;
}

describe('AdminAuditService', () => {
  let queryBuilder: ReturnType<typeof createQueryBuilderStub>;
  const createQueryBuilder = vi.fn();
  const service = new AdminAuditService({
    createQueryBuilder,
  } as never);

  beforeEach(() => {
    queryBuilder = createQueryBuilderStub();
    createQueryBuilder.mockReset();
    createQueryBuilder.mockReturnValue(queryBuilder);
  });

  it('lists recent audit events with the default limit and no filters', async () => {
    await service.listRecent({});

    expect(createQueryBuilder).toHaveBeenCalledWith('event');
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('event.id', 'DESC');
    expect(queryBuilder.take).toHaveBeenCalledWith(51);
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
  });

  it('applies supported filters and the cursor, and caps the limit', async () => {
    await service.listRecent({
      limit: '500',
      cursor: 'evt_cursor',
      eventType: 'admin.user.created',
      severity: AuditSeverity.INFO,
      actorUserId: ' usr_admin ',
      targetUserId: 'usr_target',
      clientId: 'cli_target',
    });

    expect(queryBuilder.take).toHaveBeenCalledWith(201);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.eventType = :eventType',
      { eventType: 'admin.user.created' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.severity = :severity',
      { severity: AuditSeverity.INFO },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.actorUserId = :actorUserId',
      { actorUserId: 'usr_admin' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.targetUserId = :targetUserId',
      { targetUserId: 'usr_target' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.clientId = :clientId',
      { clientId: 'cli_target' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('event.id < :cursor', {
      cursor: 'evt_cursor',
    });
  });

  it('omits the cursor clause when no cursor is given', async () => {
    await service.listRecent({ limit: 10 });

    expect(
      queryBuilder.andWhereCalls.some(
        (call) => call[0] === 'event.id < :cursor',
      ),
    ).toBe(false);
  });

  it('returns a cursor page, splitting off the lookahead row', async () => {
    queryBuilder.getMany.mockResolvedValueOnce([
      { id: 'evt_2' },
      { id: 'evt_1' },
    ]);

    const page = await service.listRecent({ limit: 1 });

    expect(page.items).toEqual([{ id: 'evt_2' }]);
    expect(page.nextCursor).toBe('evt_2');
  });

  it('reports no further pages when fewer than limit+1 rows come back', async () => {
    queryBuilder.getMany.mockResolvedValueOnce([{ id: 'evt_1' }]);

    const page = await service.listRecent({ limit: 5 });

    expect(page.items).toEqual([{ id: 'evt_1' }]);
    expect(page.nextCursor).toBeNull();
  });

  it('rejects invalid limit and severity values before touching the repository', async () => {
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

    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects blank filters before touching the repository', async () => {
    await expect(
      service.listRecent({
        eventType: ' ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createQueryBuilder).not.toHaveBeenCalled();
  });
});
