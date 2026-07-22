import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';
import { server } from '../mocks/server';
import { apiPost } from './api-client';
import { hardNavigate } from './navigation';
import { useAdminMutation } from './mutations';
import { ReauthProvider } from './reauth';
import { SessionBoundary } from './session';

vi.mock('./navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./navigation')>();

  return { ...actual, hardNavigate: vi.fn() };
});

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
  server.use(
    http.post('/admin/api/probe', () =>
      HttpResponse.json(
        {
          statusCode: 403,
          message: 'Recent admin authentication required.',
          error: 'Forbidden',
        },
        { status: 403 },
      ),
    ),
  );
}

test('recent-auth 403 opens the dialog and "Sign in again" navigates back to the current page', async () => {
  useRecentAuthProbeHandler();
  renderProbe();

  fireEvent.click(await screen.findByRole('button', { name: 'Run action' }));

  expect(await screen.findByText('Fresh sign-in required')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));

  expect(vi.mocked(hardNavigate)).toHaveBeenCalledWith(
    expect.stringContaining('/admin/login?returnTo='),
  );
});

test('cancelling the re-auth dialog fails the pending action', async () => {
  useRecentAuthProbeHandler();
  renderProbe();

  fireEvent.click(await screen.findByRole('button', { name: 'Run action' }));

  expect(await screen.findByText('Fresh sign-in required')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(await screen.findByText('Action failed')).toBeDefined();
});
