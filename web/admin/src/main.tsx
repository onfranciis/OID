import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './app/query';
import { createAppRouter } from './app/router';
import { ErrorBoundary } from './components/error-boundary';
import './styles/theme.css';

// MSW mocks the /admin/api/* contract in dev. Production builds never load the
// worker (hits the real API served same-origin by NestJS). In dev, set
// VITE_USE_REAL_API=1 to bypass MSW and proxy to a running backend instead.
async function enableMocking(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_REAL_API) {
    return;
  }

  const { worker } = await import('./mocks/browser');

  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  });
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container missing in index.html');
}

void enableMocking().then(() => {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={createAppRouter()} />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
});
