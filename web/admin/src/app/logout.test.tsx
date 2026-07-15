import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';
import { server } from '../mocks/server';
import { renderApp } from '../test/render';
import { hardNavigate } from './navigation';

vi.mock('./navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./navigation')>();

  return { ...actual, hardNavigate: vi.fn() };
});

test('signing out posts to /logout and redirects to provider login', async () => {
  let loggedOut = false;
  server.use(
    http.post('/logout', () => {
      loggedOut = true;

      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderApp('/');

  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

  await vi.waitFor(() => {
    expect(loggedOut).toBe(true);
    expect(vi.mocked(hardNavigate)).toHaveBeenCalledWith('/login');
  });
});
