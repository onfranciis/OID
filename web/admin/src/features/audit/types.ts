import type { BadgeTone } from '../../components/status-badge';

// Shapes from docs/ADMIN_API_CONTRACT.md, mirroring AuditEventEntity.

export type AuditSeverity = 'info' | 'warning' | 'critical';

export const AUDIT_SEVERITIES: AuditSeverity[] = [
  'info',
  'warning',
  'critical',
];

export interface AuditEvent {
  id: string;
  eventType: string;
  severity: AuditSeverity;
  actorUserId: string | null;
  targetUserId: string | null;
  clientId: string | null;
  providerSessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// The filters the backend audit endpoint accepts today.
export interface AuditFilters {
  eventType?: string;
  severity?: AuditSeverity;
  actorUserId?: string;
  targetUserId?: string;
  clientId?: string;
  limit?: number;
}

export interface AuditEventListResponse {
  items: AuditEvent[];
  nextCursor: string | null;
}

export function auditSeverityTone(severity: AuditSeverity): BadgeTone {
  switch (severity) {
    case 'info':
      return 'muted';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'danger';
  }
}
