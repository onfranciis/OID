import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './app/query';
import { createAppRouter } from './app/router';
import './styles/theme.css';

// MSW mocks the /admin/api/* contract in dev until the backend read layer
// (B-07) lands; production builds never load the worker (F6 removes it).
async function enableMocking(): Promise<void> {
  if (!import.meta.env.DEV) {
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
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={createAppRouter()} />
      </QueryClientProvider>
    </StrictMode>,
  );
});
