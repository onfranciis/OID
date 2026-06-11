import { AuditSeverity } from '../database/entities/audit-event.entity';

export interface AuditEventRecordInput {
  eventType: string;
  severity: AuditSeverity;
  actorUserId?: string | null;
  targetUserId?: string | null;
  clientId?: string | null;
  providerSessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}
