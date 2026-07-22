import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditEventEntity,
  AuditSeverity,
} from '../database/entities/audit-event.entity';
import { toCursorPage, type CursorPage } from './admin-pagination';

const DEFAULT_AUDIT_LIMIT = 50;
const MAX_AUDIT_LIMIT = 200;

export interface AdminAuditQueryInput {
  cursor?: string;
  limit?: string | number;
  eventType?: string;
  severity?: AuditSeverity;
  actorUserId?: string;
  targetUserId?: string;
  clientId?: string;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly auditEventRepository: Repository<AuditEventEntity>,
  ) {}

  async listRecent(
    input: AdminAuditQueryInput,
  ): Promise<CursorPage<AuditEventEntity>> {
    const limit = normalizeLimit(input.limit);
    const eventType =
      input.eventType !== undefined
        ? normalizeOptionalFilter(input.eventType, 'eventType')
        : undefined;
    const severity =
      input.severity !== undefined
        ? normalizeSeverity(input.severity)
        : undefined;
    const actorUserId =
      input.actorUserId !== undefined
        ? normalizeOptionalFilter(input.actorUserId, 'actorUserId')
        : undefined;
    const targetUserId =
      input.targetUserId !== undefined
        ? normalizeOptionalFilter(input.targetUserId, 'targetUserId')
        : undefined;
    const clientId =
      input.clientId !== undefined
        ? normalizeOptionalFilter(input.clientId, 'clientId')
        : undefined;

    const query = this.auditEventRepository
      .createQueryBuilder('event')
      .orderBy('event.id', 'DESC')
      .take(limit + 1);

    if (eventType !== undefined) {
      query.andWhere('event.eventType = :eventType', { eventType });
    }

    if (severity !== undefined) {
      query.andWhere('event.severity = :severity', { severity });
    }

    if (actorUserId !== undefined) {
      query.andWhere('event.actorUserId = :actorUserId', { actorUserId });
    }

    if (targetUserId !== undefined) {
      query.andWhere('event.targetUserId = :targetUserId', { targetUserId });
    }

    if (clientId !== undefined) {
      query.andWhere('event.clientId = :clientId', { clientId });
    }

    if (input.cursor) {
      query.andWhere('event.id < :cursor', { cursor: input.cursor });
    }

    return toCursorPage(await query.getMany(), limit);
  }
}

function normalizeLimit(value: string | number | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_AUDIT_LIMIT;
  }

  const parsedValue =
    typeof value === 'number' ? value : Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new BadRequestException('limit must be a positive integer.');
  }

  return Math.min(parsedValue, MAX_AUDIT_LIMIT);
}

function normalizeOptionalFilter(value: string, fieldName: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(`${fieldName} must not be blank.`);
  }

  return normalizedValue;
}

function normalizeSeverity(severity: AuditSeverity): AuditSeverity {
  if (!Object.values(AuditSeverity).includes(severity)) {
    throw new BadRequestException('Unsupported audit severity.');
  }

  return severity;
}
