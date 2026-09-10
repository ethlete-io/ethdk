import { expect, test } from './support';

test.describe('the day view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('reconstructs the seeded morning into a row that names its issue', async ({ page }) => {
    await expect(page.locator('[data-kind="row"]').first()).toHaveAttribute('title', 'ABC-3010 · 1h 30m');
    await expect(page.getByText('feat(users): Invite a member by email').first()).toBeVisible();
  });

  /**
   * The work nothing could name is a band of its own, drawn once. It used to be a block behind the
   * rows as well, which drew the same hour twice.
   */
  test('reports the work no issue claims as a band rather than dropping it', async ({ page }) => {
    await expect(page.getByText(/matched no issue/).first()).toBeVisible();

    const bands = page.locator('[data-kind="row"]');

    await expect(bands).toHaveCount(2);
    await expect(bands.nth(1)).toHaveAttribute('title', 'Not yet named · 1h 0m');
  });

  test('says so when the agent named nothing, rather than looking unpressed', async ({ page }) => {
    await page.getByRole('button', { name: 'Ask for suggestions' }).click();

    await expect(page.getByText('The agent had no suggestion')).toBeVisible();
  });

  test('runs the agent again when the button offers to', async ({ page }) => {
    await page.getByRole('button', { name: 'Ask for suggestions' }).click();

    const again = page.getByRole('button', { name: 'Ask again' });

    await expect(again).toBeVisible();

    await again.click();

    await expect(page.getByText('Suggested ABC-3010')).toBeVisible();
  });

  test('opens the create-ticket form on no parent, never on a guess', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const parent = page.locator('et-form-field').filter({ hasText: 'Parent' }).locator('input');

    await expect(parent).toHaveValue('');
  });

  test('drafts the summary and the description from what the work left behind', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const field = (label: string) => page.locator('et-form-field').filter({ hasText: label });

    await expect(field('Summary').locator('input')).toHaveValue('Pdf export');
    await expect(field('Description').locator('textarea')).toHaveValue(/Recorded from .* on branch feat\/pdf-export/);
  });

  test('quotes only the commit subject, never a window title', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a ticket' }).click();

    const description = page.locator('et-form-field').filter({ hasText: 'Description' }).locator('textarea');

    await expect(description).toHaveValue(/Try pdfkit for the invoice export/);
    await expect(description).not.toHaveValue(/pdf-export\.ts/);
  });
});
