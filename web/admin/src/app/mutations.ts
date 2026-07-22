import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { isRecentAuthError } from './api-client';
import { useReauth } from './reauth';

// On a recent-auth 403, opens the re-auth dialog and retries once confirmed.
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
