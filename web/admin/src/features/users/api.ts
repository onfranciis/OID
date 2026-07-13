import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPost } from '../../app/api-client';
import { useAdminMutation } from '../../app/mutations';
import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  SetUserStatusResponse,
  UserDetail,
  UserListResponse,
  UserStatus,
} from './types';

export interface UsersListParams {
  q?: string;
  status?: UserStatus;
}

export const usersKeys = {
  all: ['users'] as const,
  list: (params: UsersListParams) => ['users', 'list', params] as const,
  detail: (userId: string) => ['users', 'detail', userId] as const,
};

function buildUsersPath(params: UsersListParams & { cursor?: string }): string {
  const search = new URLSearchParams();

  if (params.q) {
    search.set('q', params.q);
  }

  if (params.status) {
    search.set('status', params.status);
  }

  if (params.cursor) {
    search.set('cursor', params.cursor);
  }

  const queryString = search.toString();

  return `/admin/api/users${queryString ? `?${queryString}` : ''}`;
}

export function useUsersList(params: UsersListParams) {
  return useInfiniteQuery({
    queryKey: usersKeys.list(params),
    queryFn: ({ pageParam }) =>
      apiGet<UserListResponse>(
        buildUsersPath({ ...params, cursor: pageParam }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useUserDetail(userId: string) {
  return useQuery({
    queryKey: usersKeys.detail(userId),
    queryFn: () => apiGet<UserDetail>(`/admin/api/users/${userId}`),
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();

  return () => void queryClient.invalidateQueries({ queryKey: usersKeys.all });
}

export function useCreateUser() {
  const invalidateUsers = useInvalidateUsers();

  return useAdminMutation<UserDetail, AdminCreateUserInput>({
    mutationFn: (input) => apiPost<UserDetail>('/admin/api/users', input),
    onSuccess: invalidateUsers,
  });
}

export function useUpdateUser(userId: string) {
  const invalidateUsers = useInvalidateUsers();

  return useAdminMutation<UserDetail, AdminUpdateUserInput>({
    mutationFn: (input) =>
      apiPost<UserDetail>(`/admin/api/users/${userId}`, input),
    onSuccess: invalidateUsers,
  });
}

export function useSetUserStatus(userId: string) {
  const invalidateUsers = useInvalidateUsers();

  return useAdminMutation<SetUserStatusResponse, UserStatus>({
    mutationFn: (status) =>
      apiPost<SetUserStatusResponse>(`/admin/api/users/${userId}/status`, {
        status,
      }),
    onSuccess: invalidateUsers,
  });
}

export function useAddUserToGroup(userId: string) {
  const invalidateUsers = useInvalidateUsers();

  return useAdminMutation<unknown, string>({
    mutationFn: (groupId) =>
      apiPost(`/admin/api/groups/${groupId}/members/${userId}`),
    onSuccess: invalidateUsers,
  });
}

export function useRemoveUserFromGroup(userId: string) {
  const invalidateUsers = useInvalidateUsers();

  return useAdminMutation<unknown, string>({
    mutationFn: (groupId) =>
      apiPost(`/admin/api/groups/${groupId}/members/${userId}/remove`),
    onSuccess: invalidateUsers,
  });
}
