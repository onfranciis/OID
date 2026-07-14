import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { renderApp } from '../test/render';

test('shell exposes a skip link and a focusable main landmark', async () => {
  renderApp('/');

  await screen.findByRole('heading', { name: 'Admin console' });

  expect(screen.getByRole('link', { name: 'Skip to content' })).toBeDefined();

  const main = document.getElementById('admin-main');
  expect(main).not.toBeNull();
  expect(main?.tabIndex).toBe(-1);
});

test('the document title reflects the active section', async () => {
  renderApp('/users');

  await screen.findByRole('heading', { name: 'Users' });

  await waitFor(() => expect(document.title).toBe('Users · Internal ID Admin'));
});

test('active nav link is marked aria-current for assistive tech', async () => {
  renderApp('/clients');

  await screen.findByRole('heading', { name: 'Clients' });

  const nav = screen.getByRole('navigation', { name: 'Admin sections' });
  const current = within(nav).getByRole('link', { current: 'page' });
  expect(current.textContent).toBe('Clients');
});

test('no session, CSRF, or secret material is written to web storage', async () => {
  renderApp('/users/usr_seed000000000000000000000001');

  await screen.findByRole('heading', { name: 'Alice Adeyemi' });

  // Drive a CSRF-protected mutation end-to-end.
  fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend user' }));

  await screen.findByText('Status set to suspended');

  // The token lives only in memory; nothing is persisted for exfiltration.
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});
