import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx responses are deterministic (auth, validation, not found); only
      // transient 5xx/network failures are worth retrying.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.statusCode < 500) {
          return false;
        }

        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  session: ['session'] as const,
};
