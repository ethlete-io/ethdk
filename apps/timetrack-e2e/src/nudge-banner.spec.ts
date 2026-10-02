import { Page } from '@playwright/test';
import { addAnEntry, expect, goToView, logTheNamedRow, saveSurface, test } from './support';

const banner = (page: Page) => page.getByRole('status').filter({ hasText: /^Your day/ });

const TUESDAY = /Tuesday.*\b11\b/;
const WEDNESDAY = /Wednesday.*\b12\b/;

test.describe('the reminder banner', () => {
  test('opens the sync view on today when another day was showing', async ({ page }) => {
    await page.goto('/day');
    await expect(banner(page)).toContainText('is not in Tempo yet');

    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.getByText(TUESDAY).first()).toBeVisible();

    await banner(page).getByRole('link', { name: 'Sync the day' }).click();

    await expect(page).toHaveURL(/\/sync$/);
    await expect(page.getByText(WEDNESDAY)).toBeVisible();
    await expect(page.getByText(TUESDAY)).toBeHidden();
  });

  test('opens the day view on today when the day only waits on a decision', async ({ page }) => {
    await page.goto('/day');
    await logTheNamedRow(page);
    await goToView(page, 'sync');
    await page.getByRole('button', { name: 'Plan this day' }).click();
    await page.getByRole('button', { name: 'Write 1 change to Tempo' }).click();
    await expect(page.getByRole('heading', { name: 'Last write' })).toBeVisible();
    await page.evaluate(() => {
      window.location.hash = '#/day';
    });
    await addAnEntry(page);
    await saveSurface(page);
    await expect(banner(page)).toContainText('matched no issue');

    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.getByText(TUESDAY).first()).toBeVisible();

    await banner(page).getByRole('link', { name: 'Review the day' }).click();

    await expect(page).toHaveURL(/\/day$/);
    await expect(page.getByText(WEDNESDAY).first()).toBeVisible();
    await expect(page.getByText(TUESDAY)).toBeHidden();
  });
});
