import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { hardNavigate } from '../../app/navigation';
import { mockSession, MOCK_LOGIN_PASSWORD } from '../../mocks/handlers';
import { renderApp } from '../../test/render';

vi.mock('../../app/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/navigation')>();

  return { ...actual, hardNavigate: vi.fn() };
});

beforeEach(() => {
  vi.mocked(hardNavigate).mockClear();
});

// Fills the form once the CSRF init query has enabled the submit button.
async function fillLogin(email: string, password: string) {
  const button = await screen.findByRole('button', { name: 'Continue' });
  await vi.waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));

  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(button);
}

test('the login route renders without bootstrapping a session', async () => {
  renderApp('/login');

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined();
  expect(screen.getByLabelText('Email')).toBeDefined();
  expect(screen.getByLabelText('Password')).toBeDefined();
});

test('valid credentials navigate to the returnTo target', async () => {
  renderApp('/login?returnTo=/admin/users');

  await fillLogin(mockSession.user.email, MOCK_LOGIN_PASSWORD);

  await vi.waitFor(() => {
    expect(vi.mocked(hardNavigate)).toHaveBeenCalledWith('/admin/users');
  });
});

test('bad credentials show a friendly inline error, no redirect', async () => {
  renderApp('/login');

  await fillLogin(mockSession.user.email, 'wrong-password');

  expect(
    await screen.findByText('We could not sign you in with those credentials.'),
  ).toBeDefined();
  expect(vi.mocked(hardNavigate)).not.toHaveBeenCalled();
});

test('an unsafe returnTo falls back to the admin home', async () => {
  renderApp('/login?returnTo=//evil.example.com');

  await fillLogin(mockSession.user.email, MOCK_LOGIN_PASSWORD);

  await vi.waitFor(() => {
    expect(vi.mocked(hardNavigate)).toHaveBeenCalledWith('/admin');
  });
});
