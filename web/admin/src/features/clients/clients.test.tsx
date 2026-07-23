import { fireEvent, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { renderApp } from '../../test/render';

test('clients list renders seeded clients with type and status', async () => {
  renderApp('/clients');

  expect(await screen.findByText('internal-id-sample-client')).toBeDefined();
  expect(screen.getByText('Internal Dashboard (SPA)')).toBeDefined();
  expect(screen.getByText('Legacy Intranet')).toBeDefined();
});

test('status filter narrows to disabled clients', async () => {
  renderApp('/clients');

  await screen.findByText('Legacy Intranet');

  fireEvent.change(screen.getByLabelText('Filter by status'), {
    target: { value: 'disabled' },
  });

  expect(await screen.findByText('Legacy Intranet')).toBeDefined();
  await expect
    .poll(() => screen.queryByText('Internal ID Sample Client'))
    .toBeNull();
});

test('creating a client navigates to its detail page', async () => {
  renderApp('/clients/new');

  fireEvent.change(await screen.findByLabelText('Client ID'), {
    target: { value: 'brand-new-client' },
  });
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Brand New Client' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

  expect(
    await screen.findByRole('heading', { name: 'Brand New Client' }),
  ).toBeDefined();
});

test('toggling a scope chip on creation persists it on the client', async () => {
  renderApp('/clients/new');

  fireEvent.change(await screen.findByLabelText('Client ID'), {
    target: { value: 'chip-toggle-client' },
  });
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Chip Toggle Client' },
  });

  const scopesGroup = screen.getByRole('group', { name: 'Allowed scopes' });
  const profileChip = within(scopesGroup).getByRole('button', {
    name: 'profile',
  });
  expect(profileChip.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(profileChip);
  expect(profileChip.getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
  await screen.findByRole('heading', { name: 'Chip Toggle Client' });

  const policyScopesGroup = await screen.findByRole('group', {
    name: 'Allowed scopes',
  });
  expect(
    within(policyScopesGroup)
      .getByRole('button', { name: 'profile' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('duplicate client ID surfaces an inline conflict error', async () => {
  renderApp('/clients/new');

  fireEvent.change(await screen.findByLabelText('Client ID'), {
    target: { value: 'internal-id-sample-client' },
  });
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Dup' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create client' }));

  expect(await screen.findByText('Client ID is already in use.')).toBeDefined();
});

test('adding a redirect URI validates absolute https and appends it', async () => {
  renderApp('/clients/cli_sample000000000000000000000');

  fireEvent.click(await screen.findByRole('tab', { name: 'Redirect URIs' }));

  const input = await screen.findByLabelText('Redirect URI');

  // Invalid: fragment present.
  fireEvent.change(input, {
    target: { value: 'https://app.company.com/cb#frag' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(
    await screen.findByText('Redirect URI must not include a fragment.'),
  ).toBeDefined();

  // Valid.
  fireEvent.change(input, {
    target: { value: 'https://app.company.com/callback' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(
    await screen.findByText('https://app.company.com/callback'),
  ).toBeDefined();
});

test('rotating a secret confirms then reveals it once', async () => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });

  renderApp('/clients/cli_sample000000000000000000000');

  fireEvent.click(await screen.findByRole('tab', { name: 'Credentials' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Rotate secret' }));

  const dialog = await screen.findByRole('dialog');
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Rotate secret' }),
  );

  expect(await screen.findByText(/shown only once/i)).toBeDefined();
  const revealed = await screen.findByText(/oidc_secret_mock_/);
  expect(revealed).toBeDefined();

  // Dismiss: the secret is gone and not recoverable.
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await expect.poll(() => screen.queryByText(/oidc_secret_mock_/)).toBeNull();
});

test('public clients cannot rotate a secret', async () => {
  renderApp('/clients/cli_spa00000000000000000000000');

  fireEvent.click(await screen.findByRole('tab', { name: 'Credentials' }));

  expect(
    await screen.findByText(/Public clients do not use a client secret/i),
  ).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Rotate secret' })).toBeNull();
});

test('disabling a client requires confirmation', async () => {
  renderApp('/clients/cli_sample000000000000000000000');

  fireEvent.click(await screen.findByRole('tab', { name: 'Status' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Disable client' }),
  );

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByText(/OIDC flows for this client stop/i),
  ).toBeDefined();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Disable client' }),
  );

  expect(await screen.findByText('Client disabled')).toBeDefined();
});

test('refresh TTL fields validate when refresh tokens are enabled', async () => {
  renderApp('/clients/cli_spa00000000000000000000000');

  // SPA client has refresh disabled; the Policy tab is default.
  await screen.findByRole('heading', { name: 'Internal Dashboard (SPA)' });

  const toggle = screen.getByRole('checkbox', {
    name: /Allow refresh tokens/i,
  });
  fireEvent.click(toggle);

  // Fields appear with defaults; the form should now be submittable.
  expect(
    await screen.findByLabelText('Refresh idle TTL (seconds)'),
  ).toBeDefined();
});
