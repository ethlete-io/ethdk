import { expect, test } from '@playwright/test';

/**
 * The repair a filed ticket makes possible. The fixture's second branch names no issue and the
 * grammar can spell it, so filing the ticket is what unlocks the offer.
 */
const fileTheTicket = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Create a ticket' }).click();
  await page.getByRole('button', { name: 'Create in Jira' }).click();
  await expect(page.getByText(/now holds this work/)).toBeVisible();
};

test.describe('branch repair', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('offers no repair before a ticket exists to name the branch after', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Show me the steps' })).toBeHidden();
  });

  test('offers the repair once the ticket is filed', async ({ page }) => {
    await fileTheTicket(page);

    await expect(page.getByText(/feat\/pdf-export still names no issue/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show me the steps' })).toBeVisible();
  });

  test('shows every step and its undo before anything runs', async ({ page }) => {
    await fileTheTicket(page);
    await page.getByRole('button', { name: 'Show me the steps' }).click();

    const steps = page.getByRole('listitem');

    await expect(steps.filter({ hasText: 'git branch -m feat/pdf-export feat/FIP-9999-pdf-export' })).toBeVisible();
    await expect(steps.filter({ hasText: 'git push -u origin feat/FIP-9999-pdf-export' })).toBeVisible();
    await expect(steps.filter({ hasText: 'git push origin --delete feat/pdf-export' })).toBeVisible();
    await expect(page.getByText('Undo: git branch -m feat/FIP-9999-pdf-export feat/pdf-export')).toBeVisible();
  });

  test('runs nothing until the steps are confirmed', async ({ page }) => {
    await fileTheTicket(page);
    await page.getByRole('button', { name: 'Show me the steps' }).click();

    await expect(page.getByRole('button', { name: 'Run these steps' })).toBeEnabled();
    await expect(page.getByText('Repaired')).toBeHidden();
  });

  test('reports the branch it renamed after the run', async ({ page }) => {
    await fileTheTicket(page);
    await page.getByRole('button', { name: 'Show me the steps' }).click();
    await page.getByRole('button', { name: 'Run these steps' }).click();

    await expect(page.getByText(/feat\/pdf-export is now feat\/FIP-9999-pdf-export/)).toBeVisible();
  });
});
