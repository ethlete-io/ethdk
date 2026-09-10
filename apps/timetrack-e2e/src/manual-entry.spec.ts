import { Page } from '@playwright/test';
import { addAnEntry, editSurface, expect, openBand, pickIssue, saveSurface, test } from './support';

test.describe('a row the day did not see', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('offers an issue as a key, a summary and its type — not one line of prose', async ({ page }) => {
    const surface = await addAnEntry(page);

    await surface.locator('ethlete-issue-select et-select').click();

    const option = page.getByRole('option').first();

    await expect(option).toContainText('ABC-3010');
    await expect(option).toContainText('User management');
    await expect(option).toContainText('Task');
  });

  test('puts the picked issue on the day as a row written by hand', async ({ page }) => {
    const surface = await addAnEntry(page);

    await pickIssue(page, surface, /ABC-2000/);
    await saveSurface(page);

    await expect(manualBand(page)).toHaveCount(1);
  });

  test('takes a row it wrote back off the day', async ({ page }) => {
    const surface = await addAnEntry(page);

    await pickIssue(page, surface, /ABC-2000/);
    await saveSurface(page);

    const title = await manualBand(page).getAttribute('title');

    await openBand(page, title ?? '');
    await editSurface(page).getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Remove this row' }).click();

    await expect(manualBand(page)).toHaveCount(0);
  });
});

/** The band's own label is what tells a hand-written row from a reconstructed one in the DOM. */
const manualBand = (page: Page) => page.locator('[data-kind="row"]').filter({ hasText: 'by hand' });
