import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { isRecentAuthError } from './api-client';
import { useReauth } from './reauth';

// useMutation wrapper that handles the recent-auth gate transparently: when
// the backend answers 403 "Recent admin authentication required.", it opens
// the re-auth dialog and retries the mutation once after the admin confirms.
// A cancelled dialog rejects with ReauthCancelledError.
export function useAdminMutation<
  TData = unknown,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, Error, TVariables, TContext>,
): UseMutationResult<TData, Error, TVariables, TContext> {
  const { requestReauth } = useReauth();
  const { mutationFn } = options;

  if (!mutationFn) {
    throw new Error('useAdminMutation requires a mutationFn.');
  }

  return useMutation({
    ...options,
    mutationFn: async (variables, context) => {
      try {
        return await mutationFn(variables, context);
      } catch (error) {
        if (isRecentAuthError(error)) {
          await requestReauth();

          return await mutationFn(variables, context);
        }

        throw error;
      }
    },
  });
}
