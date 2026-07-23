import { RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { FullPageMessage } from './full-page';

function ErrorFallback({ onReload }: { onReload: () => void }) {
  return (
    <FullPageMessage title="Something went wrong">
      <p className="text-sm text-muted">
        The admin console hit an unexpected error. Reloading usually clears it.
      </p>

      <div className="w-full justify-center bg-amber-500 mx-auto">
        <button
          type="button"
          onClick={onReload}
          className="flex items-center gap-1.5 rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reload
        </button>
      </div>
    </FullPageMessage>
  );
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for diagnostics; no user-facing detail.
    console.error('Admin console render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onReload={() => window.location.reload()} />;
    }

    return this.props.children;
  }
}

// React Router error element: catches errors thrown during route rendering and
// keeps them off the raw router error screen.
export function RouteErrorElement() {
  const error = useRouteError();
  console.error('Admin route error', error);

  return <ErrorFallback onReload={() => window.location.reload()} />;
}
