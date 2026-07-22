import { cleanup, fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';
import { mockSession } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';

// These pages check for an existing session before rendering the form;
// simulate the common case of an unauthenticated visitor for all of them.
beforeEach(() => {
  server.use(
    http.get('/admin/api/session', () =>
      HttpResponse.json(
        { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
        { status: 401 },
      ),
    ),
  );
});

test('the login page links to forgot-password', async () => {
  renderApp('/login');

  const link = await screen.findByRole('link', { name: 'Forgot password?' });
  expect(link.getAttribute('href')).toBe('/admin/forgot-password');
});

test('requesting a reset always shows the generic success message', async () => {
  renderApp('/forgot-password');

  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: 'nobody@company.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

  expect(
    await screen.findByRole('heading', { name: 'Check your email' }),
  ).toBeDefined();
});

test('a full reset flow: request, follow the link, set a new password', async () => {
  renderApp('/forgot-password');

  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: mockSession.user.email },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  await screen.findByRole('heading', { name: 'Check your email' });
  cleanup();

  renderApp(`/reset-password/mock-reset-token-${mockSession.user.id}`);

  await screen.findByRole('heading', { name: 'Reset your password' });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'a-good-password' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'a-good-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Set password' }));

  expect(
    await screen.findByRole('heading', { name: 'Password updated' }),
  ).toBeDefined();
});

test('an invalid reset token shows an error instead of a form', async () => {
  renderApp('/reset-password/not-a-real-token');

  expect(
    await screen.findByRole('heading', { name: 'Link not available' }),
  ).toBeDefined();
});
