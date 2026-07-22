import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { hardNavigate } from './navigation';

export async function hasActiveSession(): Promise<boolean> {
  const response = await fetch(
    new URL('/admin/api/session', window.location.origin),
    {
      credentials: 'include',
      headers: { accept: 'application/json' },
    },
  );

  return response.ok;
}

// Shared by every pre-session page (login, forgot-password, reset-password,
// accept-invite): an already-authenticated visitor is bounced to returnTo
// instead of being shown a form for a session they already have.
export function useSignedInRedirect(returnTo: string): {
  isChecking: boolean;
  isSignedIn: boolean;
} {
  const query = useQuery({
    queryKey: ['auth', 'session-check'],
    queryFn: hasActiveSession,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const isSignedIn = query.data === true;

  useEffect(() => {
    if (isSignedIn) {
      hardNavigate(returnTo);
    }
  }, [isSignedIn, returnTo]);

  return { isChecking: query.isPending, isSignedIn };
}
