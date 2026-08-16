import { expect, test } from '@playwright/test';

test.describe('the day view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('reconstructs the seeded morning into a row that names its issue', async ({ page }) => {
    await expect(page.locator('button[data-kind="row"]')).toHaveAttribute('title', 'FIP-3010 · 1h 30m');
    await expect(page.getByText('feat(users): Invite a member by email').first()).toBeVisible();
  });

  test('reports the work no issue claims rather than dropping it', async ({ page }) => {
    await expect(page.getByText(/matched no issue/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'feat/pdf-export · 20m' })).toBeVisible();
  });

  test('opens the create-ticket form on no parent, never on a guess', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    await expect(page.getByRole('button', { name: 'No parent' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('drafts the summary and the description from what the work left behind', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const field = (label: string) => page.locator('et-form-field').filter({ hasText: label });

    await expect(field('Summary').locator('input')).toHaveValue('Pdf export');
    await expect(field('Description').locator('textarea')).toHaveValue(/Reconstructed from .* feat\/pdf-export/);
  });

  test('quotes only the commit subject, never a window title', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const description = page.locator('et-form-field').filter({ hasText: 'Description' }).locator('textarea');

    await expect(description).toHaveValue(/Try pdfkit for the invoice export/);
    await expect(description).not.toHaveValue(/pdf-export\.ts/);
  });
});
