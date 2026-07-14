import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { renderApp } from '../../test/render';

test('overview shows tiles, counts, quick actions, and recent activity', async () => {
  renderApp('/');

  expect(
    await screen.findByRole('heading', { name: 'Admin console' }),
  ).toBeDefined();

  // Groups tile shows the exact count (single-page list); the tile link's
  // accessible name is "<count> <label>".
  expect(await screen.findByRole('link', { name: '3 Groups' })).toBeDefined();

  // Quick actions.
  expect(screen.getByRole('link', { name: 'Create user' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Create client' })).toBeDefined();

  // Recent activity feed populated from audit.
  expect(
    (await screen.findAllByText('admin.user.created')).length,
  ).toBeGreaterThan(0);
});

test('a recent activity item deep-links into the audit section', async () => {
  renderApp('/');

  const activityLink = (
    await screen.findAllByRole('link', { name: 'admin.user.created' })
  )[0];
  fireEvent.click(activityLink);

  // Landed on the audit page with the event-type filter applied.
  expect(await screen.findByRole('heading', { name: 'Audit' })).toBeDefined();
  expect(screen.getByLabelText<HTMLInputElement>('Event type').value).toBe(
    'admin.user.created',
  );
});
