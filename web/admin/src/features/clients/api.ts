import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPost } from '../../app/api-client';
import { useAdminMutation } from '../../app/mutations';
import type {
  AdminCreateClientInput,
  AdminUpdateClientInput,
  ClientDetail,
  ClientListResponse,
  OidcClientStatus,
  RedirectUri,
  RotateSecretResult,
} from './types';

export interface ClientsListParams {
  q?: string;
  status?: OidcClientStatus;
}

export const clientsKeys = {
  all: ['clients'] as const,
  list: (params: ClientsListParams) => ['clients', 'list', params] as const,
  detail: (recordId: string) => ['clients', 'detail', recordId] as const,
};

function buildClientsPath(
  params: ClientsListParams & { cursor?: string },
): string {
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

  return `/admin/api/clients${queryString ? `?${queryString}` : ''}`;
}

export function useClientsList(params: ClientsListParams) {
  return useInfiniteQuery({
    queryKey: clientsKeys.list(params),
    queryFn: ({ pageParam }) =>
      apiGet<ClientListResponse>(
        buildClientsPath({ ...params, cursor: pageParam }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useClientDetail(recordId: string) {
  return useQuery({
    queryKey: clientsKeys.detail(recordId),
    queryFn: () => apiGet<ClientDetail>(`/admin/api/clients/${recordId}`),
  });
}

function useInvalidateClients() {
  const queryClient = useQueryClient();

  return () =>
    void queryClient.invalidateQueries({ queryKey: clientsKeys.all });
}

export function useCreateClient() {
  const invalidateClients = useInvalidateClients();

  return useAdminMutation<ClientDetail, AdminCreateClientInput>({
    mutationFn: (input) => apiPost<ClientDetail>('/admin/api/clients', input),
    onSuccess: invalidateClients,
  });
}

export function useUpdateClient(recordId: string) {
  const invalidateClients = useInvalidateClients();

  return useAdminMutation<ClientDetail, AdminUpdateClientInput>({
    mutationFn: (input) =>
      apiPost<ClientDetail>(`/admin/api/clients/${recordId}`, input),
    onSuccess: invalidateClients,
  });
}

export function useSetClientStatus(recordId: string) {
  const invalidateClients = useInvalidateClients();

  return useAdminMutation<ClientDetail, OidcClientStatus>({
    mutationFn: (status) =>
      apiPost<ClientDetail>(`/admin/api/clients/${recordId}/status`, {
        status,
      }),
    onSuccess: invalidateClients,
  });
}

export function useRotateClientSecret(recordId: string) {
  const invalidateClients = useInvalidateClients();

  return useAdminMutation<RotateSecretResult, void>({
    mutationFn: () =>
      apiPost<RotateSecretResult>(
        `/admin/api/clients/${recordId}/secret/rotate`,
      ),
    onSuccess: invalidateClients,
  });
}

export function useAddRedirectUri(recordId: string) {
  const invalidateClients = useInvalidateClients();

  return useAdminMutation<RedirectUri, string>({
    mutationFn: (uri) =>
      apiPost<RedirectUri>(`/admin/api/clients/${recordId}/redirect-uris`, {
        uri,
      }),
    onSuccess: invalidateClients,
  });
}

export function useRemoveRedirectUri(recordId: string) {
  const invalidateClients = useInvalidateClients();

  return useAdminMutation<unknown, string>({
    mutationFn: (redirectUriId) =>
      apiPost(
        `/admin/api/clients/${recordId}/redirect-uris/${redirectUriId}/remove`,
      ),
    onSuccess: invalidateClients,
  });
}
