import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import { server } from '../mocks/server';
import { apiPost } from './api-client';
import { useAdminMutation } from './mutations';
import { ReauthProvider } from './reauth';
import { SessionBoundary } from './session';

function Probe() {
  const mutation = useAdminMutation({
    mutationFn: () => apiPost<{ ok: boolean }>('/admin/api/probe'),
  });

  return (
    <div>
      <button type="button" onClick={() => mutation.mutate()}>
        Run action
      </button>
      {mutation.isSuccess ? <p>Action succeeded</p> : null}
      {mutation.isError ? <p>Action failed</p> : null}
    </div>
  );
}

function renderProbe() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SessionBoundary>
        <ReauthProvider>
          <Probe />
        </ReauthProvider>
      </SessionBoundary>
    </QueryClientProvider>,
  );
}

function useRecentAuthProbeHandler() {
  let calls = 0;

  server.use(
    http.post('/admin/api/probe', ({ request }) => {
      calls += 1;

      if (calls === 1) {
        return HttpResponse.json(
          {
            statusCode: 403,
            message: 'Recent admin authentication required.',
            error: 'Forbidden',
          },
          { status: 403 },
        );
      }

      // The retried request must still carry the double-submit CSRF header.
      if (!request.headers.get('x-csrf-token')) {
        return HttpResponse.json(
          {
            statusCode: 403,
            message: 'Invalid CSRF token.',
            error: 'Forbidden',
          },
          { status: 403 },
        );
      }

      return HttpResponse.json({ ok: true });
    }),
  );
}

test('recent-auth 403 opens the dialog and retry completes the action', async () => {
  useRecentAuthProbeHandler();
  renderProbe();

  fireEvent.click(await screen.findByRole('button', { name: 'Run action' }));

  expect(await screen.findByText('Fresh sign-in required')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Retry action' }));

  expect(await screen.findByText('Action succeeded')).toBeDefined();
});

test('cancelling the re-auth dialog fails the pending action', async () => {
  useRecentAuthProbeHandler();
  renderProbe();

  fireEvent.click(await screen.findByRole('button', { name: 'Run action' }));

  expect(await screen.findByText('Fresh sign-in required')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(await screen.findByText('Action failed')).toBeDefined();
});
