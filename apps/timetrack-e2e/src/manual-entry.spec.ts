import { Page, expect, test } from '@playwright/test';

test.describe('a row the day did not see', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Add an entry' }).click();
  });

  test('offers an issue as a key, a summary and its type — not one line of prose', async ({ page }) => {
    await page.locator('ethlete-add-entry ethlete-issue-select et-select').click();

    const option = page.getByRole('option').first();

    await expect(option).toContainText('ABC-3010');
    await expect(option).toContainText('User management');
    await expect(option).toContainText('Task');
  });

  test('puts the picked issue on the day as a row written by hand', async ({ page }) => {
    const panel = page.locator('ethlete-add-entry');

    await panel.locator('ethlete-issue-select et-select').click();
    await page.getByRole('option', { name: /ABC-2000/ }).click();
    await panel.getByRole('button', { name: 'Add the entry' }).click();

    await expect(panel).toBeHidden();
    await expect(manualRow(page)).toHaveCount(1);
    await expect(manualRow(page).getByRole('button', { name: 'Evidence for ABC-2000' })).toBeVisible();
  });

  test('takes a row it wrote back off the day', async ({ page }) => {
    const panel = page.locator('ethlete-add-entry');

    await panel.locator('ethlete-issue-select et-select').click();
    await page.getByRole('option', { name: /ABC-2000/ }).click();
    await panel.getByRole('button', { name: 'Add the entry' }).click();

    const row = manualRow(page);

    await row.getByRole('button', { name: 'Evidence for ABC-2000' }).click();
    await row.getByRole('button', { name: 'Remove this row' }).click();

    await expect(manualRow(page)).toHaveCount(0);
  });
});

/** The badge is what tells a hand-written row from a reconstructed one in the DOM. */
const manualRow = (page: Page) => page.locator('ethlete-worklog-row').filter({ hasText: 'by hand' });
