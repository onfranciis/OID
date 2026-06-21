import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AuditEventEntity,
  AuditSeverity,
} from '../database/entities/audit-event.entity';

const DEFAULT_AUDIT_LIMIT = 50;
const MAX_AUDIT_LIMIT = 200;

export interface AdminAuditQueryInput {
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

  async listRecent(input: AdminAuditQueryInput): Promise<AuditEventEntity[]> {
    const where = buildAuditWhere(input);

    return await this.auditEventRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
      take: normalizeLimit(input.limit),
    });
  }
}

function buildAuditWhere(
  input: AdminAuditQueryInput,
): FindOptionsWhere<AuditEventEntity> {
  const where: FindOptionsWhere<AuditEventEntity> = {};

  if (input.eventType !== undefined) {
    where.eventType = normalizeOptionalFilter(input.eventType, 'eventType');
  }

  if (input.severity !== undefined) {
    where.severity = normalizeSeverity(input.severity);
  }

  if (input.actorUserId !== undefined) {
    where.actorUserId = normalizeOptionalFilter(
      input.actorUserId,
      'actorUserId',
    );
  }

  if (input.targetUserId !== undefined) {
    where.targetUserId = normalizeOptionalFilter(
      input.targetUserId,
      'targetUserId',
    );
  }

  if (input.clientId !== undefined) {
    where.clientId = normalizeOptionalFilter(input.clientId, 'clientId');
  }

  return where;
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
