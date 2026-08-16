import { Page, expect, test } from '@playwright/test';

/** The seeded day is today, so it is the last row of the week the view opens on. */
const seededDay = (page: Page) => page.getByRole('listitem').last();

/**
 * The week view has no token, so it can only tell a day logged in Tempo by hand from a day nobody
 * logged at all if something wrote down what Tempo holds. The Sync preview is that something, and this
 * is the one run that proves the record survives the trip from one view to the other.
 */
test.describe('a day logged in tempo by hand', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('e2e.foreignMinutes', '90'));
    await page.goto('/');
    await page.getByLabel('Log time for FIP-3010').check();
  });

  test('reads as time tempo is behind on until a preview has read tempo', async ({ page }) => {
    await page.getByRole('link', { name: 'Week' }).click();

    await expect(seededDay(page)).toContainText('1h 30m is not in Tempo yet');
  });

  test('stops reading as unsynced once the preview has recorded what tempo holds', async ({ page }) => {
    await page.getByRole('link', { name: 'Sync' }).click();
    await page.getByRole('button', { name: 'Plan this day' }).click();
    await expect(page.getByText('Counted against this day')).toBeVisible();

    await page.getByRole('link', { name: 'Week' }).click();

    await expect(seededDay(page)).toContainText('21m matched no issue');
    await expect(seededDay(page)).not.toContainText('is not in Tempo yet');
  });
});
