import { Page } from '@playwright/test';
import { tempoWorklogOn } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** The seeded day's own row. Selected by its day key, because which of the seven it is depends on the weekday. */
const seededDay = (page: Page) => page.locator(`[data-day="${E2E_DAY_KEY}"]`);

/**
 * The week view has no token, so it can only tell a day logged in Tempo by hand from a day nobody
 * logged at all if something wrote down what Tempo holds. Both surfaces that read Tempo record it, and
 * these are the runs that prove the record survives the trip from either one to the week.
 */
test.describe('a day logged in tempo by hand', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      tempo: { worklogs: [tempoWorklogOn({ day: E2E_DAY_KEY, minutes: 90 })] },
    });
    await page.goto('/day');
    await page.getByLabel('Log time for ABC-3010').check();
  });

  test('reads what tempo holds after the day review opened the day', async ({ page }) => {
    await page.getByRole('link', { name: 'Week' }).click();

    await expect(seededDay(page)).toContainText('21m matched no issue');
    await expect(seededDay(page)).not.toContainText('is not in Tempo yet');
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
