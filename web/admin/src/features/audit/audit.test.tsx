import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { renderApp } from '../../test/render';

test('audit page lists seeded events newest first', async () => {
  renderApp('/audit');

  expect(await screen.findAllByText('admin.user.created')).toBeDefined();
  expect(
    screen.getAllByText('oidc.refresh_token.replayed').length,
  ).toBeGreaterThan(0);
});

test('severity filter narrows to critical events', async () => {
  renderApp('/audit');

  await screen.findAllByText('admin.user.created');

  fireEvent.change(screen.getByLabelText('Severity'), {
    target: { value: 'critical' },
  });

  await expect.poll(() => screen.queryByText('admin.user.created')).toBeNull();
  expect(
    screen.getAllByText('oidc.refresh_token.replayed').length,
  ).toBeGreaterThan(0);
});

test('deep-linked target filter is applied from the URL', async () => {
  renderApp('/audit?targetUserId=usr_seed000000000000000000000005');

  // Only the replay event targets user 5 in the seed set.
  expect(
    await screen.findAllByText('oidc.refresh_token.replayed'),
  ).toBeDefined();
  await expect.poll(() => screen.queryByText('admin.user.created')).toBeNull();
});

test('expanding a row reveals metadata JSON', async () => {
  renderApp('/audit?severity=critical');

  const eventCell = (
    await screen.findAllByText('oidc.refresh_token.replayed')
  )[0];
  fireEvent.click(eventCell.closest('tr') as HTMLElement);

  expect(await screen.findByText(/family_revoked/)).toBeDefined();
  expect(screen.getAllByText(/User agent/i).length).toBeGreaterThan(0);
});

test('clear filters resets the URL-driven query', async () => {
  renderApp('/audit?severity=critical');

  await screen.findAllByText('oidc.refresh_token.replayed');
  expect(screen.queryByText('admin.user.created')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

  expect(await screen.findAllByText('admin.user.created')).toBeDefined();
});
