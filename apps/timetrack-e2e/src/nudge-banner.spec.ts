import { Page } from '@playwright/test';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  addAnEntry,
  editSurface,
  expect,
  goToView,
  logTheNamedRow,
  saveSurface,
  seedWorld,
  test,
} from './support';

const banner = (page: Page) => page.getByRole('status').filter({ hasText: /^Your day/ });

const TUESDAY = /Tuesday.*\b11\b/;
const WEDNESDAY = /Wednesday.*\b12\b/;

const withOnlyAnUndecidedRow = (page: Page) =>
  seedWorld(page, {
    now: E2E_NOW,
    reviewOverrides: { [E2E_DAY_KEY]: { 'ABC-3010@2026-08-12T09:00:00.000Z': { state: 'rejected' } } },
  });

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

  test('opens the band waiting for a yes or a no when the day is already on screen', async ({ page }) => {
    await withOnlyAnUndecidedRow(page);
    await page.goto('/day');
    await expect(banner(page)).toContainText('is waiting for a yes or a no');
    await expect(page.getByText(WEDNESDAY).first()).toBeVisible();

    await banner(page).getByRole('link', { name: 'Review the day' }).click();

    await expect(editSurface(page)).toBeVisible();
    await expect(editSurface(page)).toContainText('Not yet named');
  });

  test('opens the band waiting for a yes or a no after stepping back to the day', async ({ page }) => {
    await withOnlyAnUndecidedRow(page);
    await page.goto('/day');
    await expect(banner(page)).toContainText('is waiting for a yes or a no');

    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page.getByText(TUESDAY).first()).toBeVisible();

    await banner(page).getByRole('link', { name: 'Review the day' }).click();

    await expect(page.getByText(WEDNESDAY).first()).toBeVisible();
    await expect(editSurface(page)).toBeVisible();
  });
});
