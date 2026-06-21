import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ulid } from 'ulid';
import { Repository } from 'typeorm';
import { AuditEventEntity } from '../database/entities/audit-event.entity';
import type { AuditEventRecordInput } from './audit.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly auditEventRepository: Repository<AuditEventEntity>,
  ) {}

  async record(input: AuditEventRecordInput): Promise<string> {
    const eventId = `evt_${ulid().toLowerCase()}`;
    const auditEvent = this.auditEventRepository.create({
      id: eventId,
      eventType: input.eventType,
      severity: input.severity,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      clientId: input.clientId ?? null,
      providerSessionId: input.providerSessionId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadataJson: input.metadata ?? null,
    });

    await this.auditEventRepository.save(auditEvent);

    this.logger.debug(
      JSON.stringify({
        auditEventId: eventId,
        eventType: input.eventType,
        severity: input.severity,
      }),
    );

    return eventId;
  }
}
