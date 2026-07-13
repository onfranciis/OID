import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../app/api-client';
import type { GroupListResponse } from './types';

export const groupsKeys = {
  all: ['groups'] as const,
  list: () => ['groups', 'list'] as const,
};

// Minimal for now: backs the group picker on the user detail screen. The
// full Groups feature (F4) extends this module.
export function useGroupsList() {
  return useQuery({
    queryKey: groupsKeys.list(),
    queryFn: () => apiGet<GroupListResponse>('/admin/api/groups'),
  });
}
