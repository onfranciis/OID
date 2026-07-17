import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { MOCK_LOGIN_PASSWORD } from '../../mocks/handlers';
import { renderApp } from '../../test/render';

function fillForm(values: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: values.currentPassword },
  });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: values.newPassword },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: values.confirmPassword },
  });
}

test('the sidebar links to the account page', async () => {
  renderApp('/');

  fireEvent.click(
    await screen.findByRole('link', { name: /Account settings/i }),
  );

  expect(await screen.findByRole('heading', { name: 'Account' })).toBeDefined();
});

test('changing the password with the correct current password succeeds', async () => {
  renderApp('/account');

  await screen.findByRole('heading', { name: 'Account' });
  fillForm({
    currentPassword: MOCK_LOGIN_PASSWORD,
    newPassword: 'brand-new-password',
    confirmPassword: 'brand-new-password',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

  expect(await screen.findByText('Password changed')).toBeDefined();
});

test('mismatched new/confirm passwords are caught client-side', async () => {
  renderApp('/account');

  await screen.findByRole('heading', { name: 'Account' });
  fillForm({
    currentPassword: MOCK_LOGIN_PASSWORD,
    newPassword: 'brand-new-password',
    confirmPassword: 'different-password',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

  expect(await screen.findByText('Passwords do not match.')).toBeDefined();
});

test('a wrong current password surfaces a toast and does not clear the form', async () => {
  renderApp('/account');

  await screen.findByRole('heading', { name: 'Account' });
  fillForm({
    currentPassword: 'not-the-right-password',
    newPassword: 'brand-new-password',
    confirmPassword: 'brand-new-password',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

  expect(await screen.findByText('Could not change password')).toBeDefined();
  expect(await screen.findByText('Invalid password')).toBeDefined();
  expect(
    (screen.getByLabelText('New password') as unknown as HTMLInputElement)
      .value,
  ).toBe('brand-new-password');
});
