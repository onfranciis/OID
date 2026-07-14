import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../app/api-client';
import type { AuditEvent, AuditFilters } from './types';

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => ['audit', 'list', filters] as const,
};

function buildAuditPath(filters: AuditFilters): string {
  const search = new URLSearchParams();

  if (filters.eventType) {
    search.set('eventType', filters.eventType);
  }
  if (filters.severity) {
    search.set('severity', filters.severity);
  }
  if (filters.actorUserId) {
    search.set('actorUserId', filters.actorUserId);
  }
  if (filters.targetUserId) {
    search.set('targetUserId', filters.targetUserId);
  }
  if (filters.clientId) {
    search.set('clientId', filters.clientId);
  }
  if (filters.limit) {
    search.set('limit', String(filters.limit));
  }

  const queryString = search.toString();

  return `/admin/api/audit-events${queryString ? `?${queryString}` : ''}`;
}

// The backend audit endpoint returns a plain array (newest first). The contract
// proposes wrapping it as { items, nextCursor } later; until then the UI treats
// the array as a single page.
export function useAuditEvents(filters: AuditFilters) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => apiGet<AuditEvent[]>(buildAuditPath(filters)),
  });
}
