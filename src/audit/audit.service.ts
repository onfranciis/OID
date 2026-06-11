import { Injectable, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import type { AuditEventRecordInput } from './audit.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  record(input: AuditEventRecordInput): Promise<string> {
    const eventId = `evt_${ulid().toLowerCase()}`;

    this.logger.debug(
      JSON.stringify({
        auditEventId: eventId,
        eventType: input.eventType,
        severity: input.severity,
      }),
    );

    return Promise.resolve(eventId);
  }
}
