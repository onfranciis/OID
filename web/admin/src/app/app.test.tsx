import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { server } from '../mocks/server';
import { hardNavigate } from './navigation';
import { routes } from './router';

vi.mock('./navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./navigation')>();

  return { ...actual, hardNavigate: vi.fn() };
});

function renderApp(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test('authenticated load renders the shell with the actor name', async () => {
  renderApp();

  expect(await screen.findByText('Internal ID Administrator')).toBeDefined();
  expect(
    screen.getByRole('navigation', { name: 'Admin sections' }),
  ).toBeDefined();
  expect(
    await screen.findByRole('heading', { name: 'Admin console' }),
  ).toBeDefined();
});

test('unauthenticated load redirects to provider login', async () => {
  server.use(
    http.get('/admin/api/session', () =>
      HttpResponse.json(
        {
          statusCode: 401,
          message: 'Admin authentication required.',
          error: 'Unauthorized',
        },
        { status: 401 },
      ),
    ),
  );

  renderApp();

  await vi.waitFor(() => {
    expect(vi.mocked(hardNavigate)).toHaveBeenCalledWith(
      '/login?returnTo=%2Fadmin',
    );
  });
});

test('authenticated non-admin session shows access denied', async () => {
  server.use(
    http.get('/admin/api/session', () =>
      HttpResponse.json({
        user: {
          id: 'usr_01mockuser000000000000000000',
          displayName: 'Regular User',
          email: 'user@company.com',
        },
        isAdmin: false,
        csrfToken: 'mock-nonce.mock-signature',
      }),
    ),
  );

  renderApp();

  expect(await screen.findByText('Admin access denied')).toBeDefined();
});

test('unknown route renders the not-found state inside the shell', async () => {
  renderApp('/no-such-page');

  expect(
    await screen.findByRole('heading', { name: 'Not found' }),
  ).toBeDefined();
});
