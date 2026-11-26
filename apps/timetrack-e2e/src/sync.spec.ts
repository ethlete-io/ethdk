import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';
import { tempoWorklogOn } from '@ethlete/timetrack/testing';

/**
 * The subtraction itself is unit-tested in `tempo/diff.spec.ts`. What only an end-to-end run can show
 * is that the preview reads Tempo at all, and reports what it found without writing anything.
 */
test.describe('the sync preview', () => {
  test('says so when tempo holds nothing for the day', async ({ page }) => {
    await page.goto('/#/sync');
    await page.getByRole('button', { name: 'Plan this day' }).click();

    await expect(page.getByText('Nothing on this day was logged outside this app.')).toBeVisible();
  });

  test('lists time somebody logged outside the app, and never plans to touch it', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      tempo: { worklogs: [tempoWorklogOn({ day: E2E_DAY_KEY, minutes: 90 })] },
    });
    await page.goto('/#/sync');
    await page.getByRole('button', { name: 'Plan this day' }).click();

    await expect(page.getByText('Logged in Tempo by hand')).toBeVisible();
    await expect(page.getByText('Written outside this app. It is never edited or deleted here.')).toBeVisible();
  });
});
