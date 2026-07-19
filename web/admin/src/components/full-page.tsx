import { LogOut, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { performLogout } from '../app/logout';

// Full-viewport states rendered outside the app shell: session loading,
// access denied, and unexpected bootstrap failures.
export function FullPageMessage({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4 font-sans text-ink">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {children ? <div className="mt-3 grid gap-4">{children}</div> : null}
      </div>
    </div>
  );
}

export function AccessDeniedScreen() {
  return (
    <FullPageMessage
      title={
        <>
          <ShieldAlert
            className="mx-auto mb-2 h-8 w-8 text-danger"
            aria-hidden="true"
          />
          Admin access denied
        </>
      }
    >
      <p className="text-sm text-muted">
        Your account is signed in but does not have administrator access to
        Internal ID. Administrators are active members of the bootstrap admin
        group.
      </p>

      <div className="w-full flex justify-center">
        <button
          type="button"
          onClick={() => void performLogout()}
          className="flex items-center gap-1.5 rounded-card border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </FullPageMessage>
  );
}
