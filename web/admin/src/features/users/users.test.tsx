import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { mockSession } from '../../mocks/handlers';
import { renderApp } from '../../test/render';

test('users list renders seeded users with status badges', async () => {
  renderApp('/users');

  expect(await screen.findByText('Alice Adeyemi')).toBeDefined();
  expect(screen.getByText('alice.adeyemi@company.com')).toBeDefined();
  // Admin user is seeded first.
  expect(
    screen.getAllByText('Internal ID Administrator').length,
  ).toBeGreaterThan(0);
});

test('search narrows the users list', async () => {
  renderApp('/users');

  await screen.findByText('Alice Adeyemi');

  fireEvent.change(screen.getByLabelText('Search users'), {
    target: { value: 'alice' },
  });

  expect(await screen.findByText('Alice Adeyemi')).toBeDefined();
  await expect.poll(() => screen.queryByText('Bola Okafor')).toBeNull();
});

test('pagination moves to the next page and back', async () => {
  renderApp('/users');

  await screen.findByText('Alice Adeyemi');
  expect(screen.getByText('Page 1')).toBeDefined();

  // 29 seeded users, page size 20: page 1 has no Previous, but has a Next.
  expect(
    screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled'),
  ).toBe(true);

  // Last seeded user is on page 2.
  expect(screen.queryByText('Bisi Eze')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  expect(await screen.findByText('Bisi Eze')).toBeDefined();
  expect(screen.getByText('Page 2')).toBeDefined();
  expect(screen.queryByText('Alice Adeyemi')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled'),
  ).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

  expect(await screen.findByText('Alice Adeyemi')).toBeDefined();
  expect(screen.getByText('Page 1')).toBeDefined();
});

test('searching resets pagination back to page 1', async () => {
  renderApp('/users');

  await screen.findByText('Alice Adeyemi');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Bisi Eze');

  fireEvent.change(screen.getByLabelText('Search users'), {
    target: { value: 'alice' },
  });

  expect(await screen.findByText('Alice Adeyemi')).toBeDefined();
  // Single-page result: pagination controls disappear entirely.
  await expect.poll(() => screen.queryByText(/^Page /)).toBeNull();
});

test('creating a user navigates to its detail page', async () => {
  renderApp('/users/new');

  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: 'new.person@company.com' },
  });
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'New Person' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

  // Detail page heading + pending status from the backend rule.
  expect(
    await screen.findByRole('heading', { name: 'New Person' }),
  ).toBeDefined();
  expect(screen.getAllByText('pending').length).toBeGreaterThan(0);
});

test('duplicate email surfaces an inline conflict error', async () => {
  renderApp('/users/new');

  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: 'alice.adeyemi@company.com' },
  });
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'Duplicate Alice' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

  expect(await screen.findByText('Email is already in use.')).toBeDefined();
});

test('editing the profile updates the detail view', async () => {
  renderApp('/users/usr_seed000000000000000000000001');

  await screen.findByRole('heading', { name: 'Alice Adeyemi' });

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'Alice A. Renamed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(
    await screen.findByRole('heading', { name: 'Alice A. Renamed' }),
  ).toBeDefined();
});

test('deactivation requires confirmation and reports revocation counts', async () => {
  renderApp('/users/usr_seed000000000000000000000001');

  await screen.findByRole('heading', { name: 'Alice Adeyemi' });

  fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByText(/revokes every provider session/i),
  ).toBeDefined();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Deactivate user' }),
  );

  expect(
    await screen.findByText(
      'Revoked 2 provider sessions and 1 refresh tokens.',
    ),
  ).toBeDefined();
  expect(await screen.findByText('Reactivate')).toBeDefined();
});

test('sending an invite lets the invited user set a password and activates them', async () => {
  const created = renderApp('/users/new');

  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: 'invitee@company.com' },
  });
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'Invitee Person' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
  await screen.findByRole('heading', { name: 'Invitee Person' });
  expect(screen.getAllByText('pending').length).toBeGreaterThan(0);

  const userId = created.router.state.location.pathname.split('/').pop();

  fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
  expect(await screen.findByText('Invite sent')).toBeDefined();
  cleanup();

  // The invited user opens the emailed link in a fresh, unauthenticated tab.
  renderApp(`/invite/mock-invite-token-${userId}`);

  await screen.findByRole('heading', { name: 'Welcome, Invitee Person' });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'a-good-password' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'a-good-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Set password' }));

  expect(
    await screen.findByRole('heading', { name: 'Password set' }),
  ).toBeDefined();
  cleanup();

  // Back in the admin console, the user is now active.
  renderApp(`/users/${userId}`);
  await screen.findByRole('heading', { name: 'Invitee Person' });
  expect(screen.getAllByText('active').length).toBeGreaterThan(0);
});

test('an admin cannot send themselves an invite', async () => {
  renderApp(`/users/${mockSession.user.id}`);

  await screen.findByRole('heading', { name: 'Internal ID Administrator' });
  expect(screen.queryByRole('button', { name: 'Send invite' })).toBeNull();
});

test('an invalid invite token shows an error instead of a form', async () => {
  renderApp('/invite/not-a-real-token');

  expect(
    await screen.findByRole('heading', { name: 'Invite not available' }),
  ).toBeDefined();
});

test('removing your own admin-group membership requires typed confirmation', async () => {
  renderApp(`/users/${mockSession.user.id}`);

  await screen.findByRole('heading', {
    name: 'Internal ID Administrator',
  });

  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByText(/revokes your access to this console/i),
  ).toBeDefined();

  const confirmButton = within(dialog).getByRole('button', {
    name: 'Remove membership',
  });
  expect(confirmButton.hasAttribute('disabled')).toBe(true);

  fireEvent.change(
    within(dialog).getByPlaceholderText(mockSession.adminGroupSlug),
    { target: { value: mockSession.adminGroupSlug } },
  );

  expect(confirmButton.hasAttribute('disabled')).toBe(false);
});
