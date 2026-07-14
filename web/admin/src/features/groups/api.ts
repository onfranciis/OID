import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPost } from '../../app/api-client';
import { useAdminMutation } from '../../app/mutations';
import type {
  AdminCreateGroupInput,
  AdminUpdateGroupInput,
  GroupDetail,
  GroupListResponse,
} from './types';

export interface GroupsListParams {
  q?: string;
}

export const groupsKeys = {
  all: ['groups'] as const,
  list: (params: GroupsListParams = {}) => ['groups', 'list', params] as const,
  detail: (groupId: string) => ['groups', 'detail', groupId] as const,
};

function buildGroupsPath(
  params: GroupsListParams & { cursor?: string },
): string {
  const search = new URLSearchParams();

  if (params.q) {
    search.set('q', params.q);
  }

  if (params.cursor) {
    search.set('cursor', params.cursor);
  }

  const queryString = search.toString();

  return `/admin/api/groups${queryString ? `?${queryString}` : ''}`;
}

// Simple (non-paginated) list for pickers; backs the user-detail group picker.
export function useGroupsList() {
  return useQuery({
    queryKey: groupsKeys.list(),
    queryFn: () => apiGet<GroupListResponse>('/admin/api/groups'),
  });
}

// Paginated + searchable list for the Groups section.
export function useGroupsInfiniteList(params: GroupsListParams) {
  return useInfiniteQuery({
    queryKey: groupsKeys.list(params),
    queryFn: ({ pageParam }) =>
      apiGet<GroupListResponse>(
        buildGroupsPath({ ...params, cursor: pageParam }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useGroupDetail(groupId: string) {
  return useQuery({
    queryKey: groupsKeys.detail(groupId),
    queryFn: () => apiGet<GroupDetail>(`/admin/api/groups/${groupId}`),
  });
}

function useInvalidateGroups() {
  const queryClient = useQueryClient();

  return () => void queryClient.invalidateQueries({ queryKey: groupsKeys.all });
}

export function useCreateGroup() {
  const invalidateGroups = useInvalidateGroups();

  return useAdminMutation<GroupDetail, AdminCreateGroupInput>({
    mutationFn: (input) => apiPost<GroupDetail>('/admin/api/groups', input),
    onSuccess: invalidateGroups,
  });
}

export function useUpdateGroup(groupId: string) {
  const invalidateGroups = useInvalidateGroups();

  return useAdminMutation<GroupDetail, AdminUpdateGroupInput>({
    mutationFn: (input) =>
      apiPost<GroupDetail>(`/admin/api/groups/${groupId}`, input),
    onSuccess: invalidateGroups,
  });
}

export function useAddGroupMember(groupId: string) {
  const invalidateGroups = useInvalidateGroups();

  return useAdminMutation<unknown, string>({
    mutationFn: (userId) =>
      apiPost(`/admin/api/groups/${groupId}/members/${userId}`),
    onSuccess: invalidateGroups,
  });
}

export function useRemoveGroupMember(groupId: string) {
  const invalidateGroups = useInvalidateGroups();

  return useAdminMutation<unknown, string>({
    mutationFn: (userId) =>
      apiPost(`/admin/api/groups/${groupId}/members/${userId}/remove`),
    onSuccess: invalidateGroups,
  });
}
