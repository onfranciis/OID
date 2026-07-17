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

test('pagination moves through pages when the page size is small', async () => {
  // 28 seeded events across 4 rounds; limit=10 forces 3 pages.
  renderApp('/audit?limit=10');

  await screen.findAllByText('admin.user.created');
  expect(screen.getByText('Page 1')).toBeDefined();
  expect(
    screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled'),
  ).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  expect(await screen.findByText('Page 2')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

  expect(await screen.findByText('Page 1')).toBeDefined();
});

test('changing a filter resets pagination back to page 1', async () => {
  renderApp('/audit?limit=10');

  await screen.findAllByText('admin.user.created');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2');

  fireEvent.change(screen.getByLabelText('Severity'), {
    target: { value: 'critical' },
  });

  // Only 4 critical events at limit=10: single page, no pagination controls.
  await screen.findAllByText('oidc.refresh_token.replayed');
  await expect.poll(() => screen.queryByText(/^Page /)).toBeNull();
});

test('clear filters resets the URL-driven query', async () => {
  renderApp('/audit?severity=critical');

  await screen.findAllByText('oidc.refresh_token.replayed');
  expect(screen.queryByText('admin.user.created')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

  expect(await screen.findAllByText('admin.user.created')).toBeDefined();
});
