import { fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { mockSession } from '../../mocks/handlers';
import { renderApp } from '../../test/render';

const ADMIN_GROUP_ID = 'grp_admins00000000000000000000';
const ENGINEERING_GROUP_ID = 'grp_engineering0000000000000';

test('groups list renders seeded groups with member counts', async () => {
  renderApp('/groups');

  expect(await screen.findByText('Engineering')).toBeDefined();
  expect(screen.getByText('Internal ID Administrators')).toBeDefined();
  expect(screen.getByText('People Operations')).toBeDefined();
});

test('search narrows the groups list', async () => {
  renderApp('/groups');

  await screen.findByText('Engineering');

  fireEvent.change(screen.getByLabelText('Search groups'), {
    target: { value: 'people' },
  });

  expect(await screen.findByText('People Operations')).toBeDefined();
  await expect.poll(() => screen.queryByText('Engineering')).toBeNull();
});

test('creating a group navigates to its detail page', async () => {
  renderApp('/groups/new');

  fireEvent.change(await screen.findByLabelText('Slug'), {
    target: { value: 'support' },
  });
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'Support Team' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create group' }));

  expect(
    await screen.findByRole('heading', { name: 'Support Team' }),
  ).toBeDefined();
});

test('duplicate slug surfaces an inline conflict error', async () => {
  renderApp('/groups/new');

  fireEvent.change(await screen.findByLabelText('Slug'), {
    target: { value: 'engineering' },
  });
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'Dup' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create group' }));

  expect(
    await screen.findByText('Group slug is already in use.'),
  ).toBeDefined();
});

test('editing group metadata updates the heading', async () => {
  renderApp(`/groups/${ENGINEERING_GROUP_ID}`);

  await screen.findByRole('heading', { name: 'Engineering' });

  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'Engineering & Platform' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(
    await screen.findByRole('heading', { name: 'Engineering & Platform' }),
  ).toBeDefined();
});

test('renaming the bootstrap admin group slug shows a warning', async () => {
  renderApp(`/groups/${ADMIN_GROUP_ID}`);

  await screen.findByRole('heading', { name: 'Internal ID Administrators' });

  expect(screen.queryByText(/bootstrap admin group/i)).toBeNull();

  fireEvent.change(screen.getByLabelText('Slug'), {
    target: { value: 'renamed-admins' },
  });

  expect(await screen.findByText(/BOOTSTRAP_ADMIN_GROUP_SLUG/)).toBeDefined();
});

test('adding a member through the picker appends them', async () => {
  renderApp(`/groups/${ENGINEERING_GROUP_ID}`);

  await screen.findByRole('heading', { name: 'Engineering' });

  fireEvent.change(screen.getByLabelText('Search users to add'), {
    target: { value: 'Alice' },
  });

  fireEvent.click(await screen.findByRole('button', { name: /Alice Adeyemi/ }));

  const members = await screen.findByRole('heading', { name: /Members/ });
  const panel = members.closest('section') as HTMLElement;
  expect(await within(panel).findByText('Alice Adeyemi')).toBeDefined();
});

test('removing yourself from the admin group requires typed confirmation', async () => {
  renderApp(`/groups/${ADMIN_GROUP_ID}`);

  await screen.findByRole('heading', { name: 'Internal ID Administrators' });

  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByText(/revokes your access to this console/i),
  ).toBeDefined();

  const confirmButton = within(dialog).getByRole('button', {
    name: 'Remove member',
  });
  expect(confirmButton.hasAttribute('disabled')).toBe(true);

  fireEvent.change(
    within(dialog).getByPlaceholderText(mockSession.adminGroupSlug),
    { target: { value: mockSession.adminGroupSlug } },
  );

  expect(confirmButton.hasAttribute('disabled')).toBe(false);
});
