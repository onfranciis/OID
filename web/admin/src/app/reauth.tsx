import * as Dialog from '@radix-ui/react-dialog';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { hardNavigate, loginUrl } from './navigation';

// On a recent-auth 403, prompts the admin to sign in again — a full-page
// navigation to login and back, so the fresh session cookie is guaranteed to
// apply here (unlike a second tab, which isn't guaranteed to share cookies in
// every embedding context). The pending action itself is not resumed
// automatically: the page reload means there's nothing left to resume, so the
// admin re-triggers the action once they're back.
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
  const [pending, setPending] = useState<PendingReauth | null>(null);

  const requestReauth = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        setPending({ resolve, reject });
      }),
    [],
  );

  const handleSignInAgain = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    hardNavigate(loginUrl(returnTo, { forceReauth: true }));
  }, []);

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
              This action is sensitive and needs a recent sign-in. Sign in again
              to continue — you&apos;ll return to this page afterward, then you
              can retry the action.
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
                onClick={handleSignInAgain}
                className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
              >
                Sign in again
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ReauthContext.Provider>
  );
}
