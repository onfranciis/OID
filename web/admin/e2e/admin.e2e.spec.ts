import { expect, test, type Page } from '@playwright/test';

// Full login-to-manage happy path against a live backend serving the built SPA.
// Requires a seeded DB and bootstrap admin credentials (see playwright.config.ts).

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@company.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

async function signIn(page: Page): Promise<void> {
  // Unauthenticated visit to the SPA redirects to the provider-owned login page.
  await page.goto('/admin');
  await page.waitForURL(/\/login/);

  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // After login the returnTo brings us back into the admin console.
  await page.waitForURL(/\/admin/);
  await expect(
    page.getByRole('heading', { name: 'Admin console' }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  test.skip(
    ADMIN_PASSWORD === '',
    'Set E2E_ADMIN_PASSWORD (and a seeded backend) to run admin e2e.',
  );
  await signIn(page);
});

test('overview loads with the section tiles', async ({ page }) => {
  await expect(page.getByRole('link', { name: /Users/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Clients/ })).toBeVisible();
});

test('users section lists users and opens a detail view', async ({ page }) => {
  await page.getByRole('link', { name: 'Users' }).click();
  await page.waitForURL(/\/admin\/users$/);

  await expect(
    page.getByRole('heading', { name: 'Users' }),
  ).toBeVisible();

  // Open the first user row.
  const firstRow = page.locator('tbody tr').first();
  await firstRow.click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('clients section exposes the tabbed detail', async ({ page }) => {
  await page.getByRole('link', { name: 'Clients' }).click();
  await page.waitForURL(/\/admin\/clients$/);

  await page.locator('tbody tr').first().click();
  await expect(page.getByRole('tab', { name: 'Redirect URIs' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Credentials' })).toBeVisible();
});

test('audit section renders the event stream', async ({ page }) => {
  await page.getByRole('link', { name: 'Audit' }).click();
  await page.waitForURL(/\/admin\/audit/);

  await expect(page.getByRole('heading', { name: 'Audit' })).toBeVisible();
  await expect(page.getByLabel('Severity')).toBeVisible();
});
