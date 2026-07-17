import { useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '../../app/api-client';
import type { AuditEventListResponse, AuditFilters } from './types';

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => ['audit', 'list', filters] as const,
};

function buildAuditPath(filters: AuditFilters & { cursor?: string }): string {
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
  if (filters.cursor) {
    search.set('cursor', filters.cursor);
  }

  const queryString = search.toString();

  return `/admin/api/audit-events${queryString ? `?${queryString}` : ''}`;
}

// Cursor-paginated over the prefixed-ULID id, same shape as users/groups/
// clients. The Audit page pages through this one page at a time; Overview
// reads just the first page for its "recent activity" widget.
export function useAuditEvents(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(filters),
    queryFn: ({ pageParam }) =>
      apiGet<AuditEventListResponse>(
        buildAuditPath({ ...filters, cursor: pageParam }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
