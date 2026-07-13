import * as Dialog from '@radix-ui/react-dialog';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { loginUrl } from './navigation';
import { useSession } from './session';

// Sensitive admin mutations pass AdminRecentAuthGuard on the backend, which
// requires a sign-in within the recent-auth window (default 600s). When a
// mutation hits that 403, this provider opens a dialog: the admin signs in
// again in a NEW tab (the SPA and its in-flight state survive, and the session
// cookie is shared browser-wide), then retries the action from the dialog.

export class ReauthCancelledError extends Error {
  constructor() {
    super('Re-authentication was cancelled.');
    this.name = 'ReauthCancelledError';
  }
}

export function isReauthCancelled(error: unknown): boolean {
  return error instanceof ReauthCancelledError;
}

interface PendingReauth {
  resolve: () => void;
  reject: (reason: unknown) => void;
}

interface ReauthContextValue {
  requestReauth: () => Promise<void>;
}

const ReauthContext = createContext<ReauthContextValue | null>(null);

export function useReauth(): ReauthContextValue {
  const context = useContext(ReauthContext);

  if (!context) {
    throw new Error('useReauth must be used inside ReauthProvider.');
  }

  return context;
}

export function ReauthProvider({ children }: { children: ReactNode }) {
  const { refreshSession } = useSession();
  const [pending, setPending] = useState<PendingReauth | null>(null);

  const requestReauth = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        setPending({ resolve, reject });
      }),
    [],
  );

  const handleRetry = useCallback(async () => {
    // Re-fetch the session first: it confirms the fresh sign-in and rotates
    // the CSRF token before the caller retries its mutation.
    await refreshSession();
    pending?.resolve();
    setPending(null);
  }, [pending, refreshSession]);

  const handleCancel = useCallback(() => {
    pending?.reject(new ReauthCancelledError());
    setPending(null);
  }, [pending]);

  return (
    <ReauthContext.Provider value={{ requestReauth }}>
      {children}
      <Dialog.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleCancel();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-surface p-6 font-sans text-ink shadow-lg">
            <Dialog.Title className="text-lg font-semibold">
              Fresh sign-in required
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted">
              This action is sensitive and needs a recent sign-in. Open the
              provider sign-in in a new tab, complete it, then retry the action
              here.
            </Dialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-card border border-line px-4 py-2 text-sm text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(loginUrl('/admin'), '_blank', 'noopener');
                }}
                className="rounded-card border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
              >
                Open sign-in
              </button>
              <button
                type="button"
                onClick={() => void handleRetry()}
                className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
              >
                Retry action
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ReauthContext.Provider>
  );
}
