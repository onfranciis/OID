import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import { AccessDeniedScreen, FullPageMessage } from '../components/full-page';
import {
  ApiError,
  apiGet,
  isForbiddenError,
  isUnauthorizedError,
  setCsrfToken,
} from './api-client';
import { hardNavigate, loginUrl } from './navigation';
import { queryKeys } from './query';

export interface SessionUser {
  id: string;
  displayName: string;
  email: string;
}

export interface SessionInfo {
  user: SessionUser;
  isAdmin: boolean;
  csrfToken: string;
}

interface SessionContextValue {
  user: SessionUser;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionBoundary.');
  }

  return context;
}

async function fetchSession(): Promise<SessionInfo> {
  const session = await apiGet<SessionInfo>('/admin/api/session');

  // The CSRF cookie is HttpOnly, so the bootstrap response is the only place
  // the SPA can learn the token it must echo on mutations.
  setCsrfToken(session.csrfToken);

  return session;
}

// The auth boundary from FRONTEND_ROADMAP.md 7.1/7.7: bootstraps the session,
// hard-redirects unauthenticated visitors to provider login, and blocks
// non-admins with a quiet access-denied screen.
export function SessionBoundary({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const unauthorized = query.isError && isUnauthorizedError(query.error);

  useEffect(() => {
    if (unauthorized) {
      hardNavigate(loginUrl('/admin'));
    }
  }, [unauthorized]);

  const { refetch } = query;
  const refreshSession = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (query.isPending || unauthorized) {
    return (
      <FullPageMessage title="Internal ID Admin">
        <p className="text-sm text-muted">
          {unauthorized
            ? 'Redirecting to sign-in…'
            : 'Loading the admin console…'}
        </p>
      </FullPageMessage>
    );
  }

  if (query.isError) {
    if (isForbiddenError(query.error)) {
      return <AccessDeniedScreen />;
    }

    return (
      <FullPageMessage title="Something went wrong">
        <p className="text-sm text-muted">
          {query.error instanceof ApiError
            ? query.error.message
            : 'The admin console could not load.'}
        </p>
        <div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </FullPageMessage>
    );
  }

  if (!query.data.isAdmin) {
    return <AccessDeniedScreen />;
  }

  return (
    <SessionContext.Provider value={{ user: query.data.user, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}
