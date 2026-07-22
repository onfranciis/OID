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
//
// Pass `enabled: false` to skip this entirely — the login page's re-auth
// path needs exactly the opposite behavior: an existing session is precisely
// what's too stale and needs replacing, so it must never redirect away
// before the admin gets a chance to sign in again.
export function useSignedInRedirect(
  returnTo: string,
  options?: { enabled?: boolean },
): {
  isChecking: boolean;
  isSignedIn: boolean;
} {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: ['auth', 'session-check'],
    queryFn: hasActiveSession,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    enabled,
  });
  const isSignedIn = enabled && query.data === true;

  useEffect(() => {
    if (isSignedIn) {
      hardNavigate(returnTo);
    }
  }, [isSignedIn, returnTo]);

  return { isChecking: enabled && query.isPending, isSignedIn };
}
