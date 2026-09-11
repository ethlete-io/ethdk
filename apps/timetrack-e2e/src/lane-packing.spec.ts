import { Locator, Page } from '@playwright/test';
import { E2E_DAY_KEY, addAnEntry, expect, pickIssue, saveSurface, seedWorld, test } from './support';

/**
 * The hour a hand-written row covers is the one that just finished, so the clock decides where its
 * halves fall. 16:00 is one of the hours whose half-hour mark does not reproduce exactly as a
 * percent of the day from the row before it.
 */
const NOW = `${E2E_DAY_KEY}T17:00:00.000Z`;

/**
 * A day nothing was collected for, so the only rows on it are the ones the spec writes by hand. The
 * pack and the handles are then asserted over the whole page rather than over one lane of many.
 */
test.beforeEach(async ({ page }) => {
  await seedWorld(page, { now: NOW, events: [] });
  await page.goto('/day');

  const surface = await addAnEntry(page);

  await pickIssue(page, surface, /ABC-2000/);
  await saveSurface(page);
});

/** A pack that compares percentages of the day reads the two halves of 16:00 to 17:00 as overlapping. */
test.describe('two rows that meet', () => {
  test.beforeEach(async ({ page }) => {
    await splitInHalf(rows(page).first(), page);
    await expect(rows(page)).toHaveCount(2);
  });

  test('each take the whole lane, rather than half of it each', async ({ page }) => {
    const first = await boxOf(rows(page).first());
    const second = await boxOf(rows(page).last());

    expect(second.x).toBeCloseTo(first.x, 0);
    expect(second.width).toBeCloseTo(first.width, 0);
  });
});

test.describe('the handle between two rows', () => {
  test('is offered where one row can give a step to the other', async ({ page }) => {
    await splitInHalf(rows(page).first(), page);

    await expect(handles(page)).toHaveCount(1);
  });

  test('moves a step of time from one row to the other', async ({ page }) => {
    await splitInHalf(rows(page).first(), page);
    await handles(page).focus();
    await handles(page).press('ArrowDown');

    await expect(rows(page).first()).toHaveAttribute('title', 'ABC-2000 · 45m · by hand');
    await expect(rows(page).last()).toHaveAttribute('title', 'ABC-2000 · 15m');
  });

  test('is not offered where both rows are already one step long', async ({ page }) => {
    await splitInHalf(rows(page).first(), page);
    await splitInHalf(rows(page).first(), page);
    await expect(rows(page)).toHaveCount(3);

    await expect(handles(page)).toHaveCount(1);
    await expect(handles(page)).toHaveAttribute('aria-valuetext', '04:30 PM');
  });
});

const rows = (page: Page) => page.locator('[data-lane] [data-kind="row"]');

const handles = (page: Page) => page.locator('[data-lane] [role="separator"]');

const splitInHalf = async (band: Locator, page: Page) => {
  await band.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Split in half' }).click();
};

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('the band is not on the page');

  return box;
};
