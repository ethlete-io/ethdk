import { Locator, Page } from '@playwright/test';
import { E2E_DAY_KEY, addAnEntry, expect, pickIssue, saveSurface, seedWorld, test } from './support';

/** The hour a hand-written row covers is the one that just finished, so this day's work is 16:00 to 17:00. */
const NOW = `${E2E_DAY_KEY}T17:00:00.000Z`;

/** Tall enough that the whole drawn hour, and the empty grid under it, is on screen to be probed. */
test.use({ viewport: { width: 1400, height: 1200 } });

/**
 * A day nothing was collected for, cut by hand into a run of three bands in one lane: 16:00, 16:15
 * and 16:30. A run of fragments in one checkout is what the marking is for.
 */
test.beforeEach(async ({ page }) => {
  await seedWorld(page, { now: NOW, events: [] });
  await page.goto('/day');

  const surface = await addAnEntry(page);

  await pickIssue(page, surface, /ABC-2000/);
  await saveSurface(page);

  await splitInHalf(page, band(page, 0));
  await splitInHalf(page, band(page, 0));
  await expect(bands(page)).toHaveCount(3);
});

test.describe('marking a band', () => {
  test('a modifier-click marks the band it landed on, and says how many are marked', async ({ page }) => {
    await mark(band(page, 0));

    await expect(marked(page)).toHaveCount(1);
    await expect(bar(page)).toContainText('1 marked for a merge');
  });

  test('a modifier-click does not open the edit surface', async ({ page }) => {
    await mark(band(page, 0));

    await expect(page.locator('et-scheduler-edit-surface')).toBeHidden();
  });

  test('a shift-click marks the whole run through to the band it landed on', async ({ page }) => {
    await mark(band(page, 0));
    await band(page, 2).click({ modifiers: ['Shift'] });

    await expect(marked(page)).toHaveCount(3);
    await expect(bar(page)).toContainText('3 marked for a merge');
  });

  test('escape clears the marks', async ({ page }) => {
    await mark(band(page, 0));
    await mark(band(page, 1));
    await expect(marked(page)).toHaveCount(2);

    await page.locator('ethlete-day-timeline').press('Escape');

    await expect(marked(page)).toHaveCount(0);
    await expect(bar(page)).toBeHidden();
  });

  test('stepping to another day and back clears them too', async ({ page }) => {
    await mark(band(page, 0));
    await expect(marked(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Previous day' }).click();
    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(bands(page)).toHaveCount(3);

    await expect(marked(page)).toHaveCount(0);
  });
});

test.describe('the merge', () => {
  test('is offered in the menu of a band that is itself marked', async ({ page }) => {
    await mark(band(page, 0));
    await mark(band(page, 1));
    await band(page, 0).click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: /Merge the 2 marked rows/ })).toBeVisible();
  });

  test('is not offered in the menu of a band the marks do not include', async ({ page }) => {
    await mark(band(page, 0));
    await mark(band(page, 1));
    await band(page, 2).click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: 'Split in half' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /marked rows/ })).toBeHidden();
  });

  test('folds the marked run into one row of the whole hour', async ({ page }) => {
    await mark(band(page, 0));
    await band(page, 2).click({ modifiers: ['Shift'] });
    await bar(page).getByRole('button', { name: 'Merge into one row' }).click();

    await expect(bands(page)).toHaveCount(1);
    await expect(bands(page)).toHaveAttribute('title', /1h/);
    await expect(bar(page)).toBeHidden();
  });
});

test.describe('hovering a band', () => {
  test('changes its fill, so the pointer has an answer on the band itself', async ({ page }) => {
    const target = band(page, 2);

    // The split leaves the pointer on the band the menu item covered, so the resting fill is only
    // readable once the pointer is off the grid.
    await page.mouse.move(5, 5);

    const resting = await backgroundOf(target);

    await target.hover();

    await expect.poll(() => backgroundOf(target)).not.toBe(resting);
  });
});

test.describe('the cursor', () => {
  test('says a press on empty lane draws a range', async ({ page }) => {
    const box = await boxOf(band(page, 2));

    expect(await probe(page, box.x + box.width / 2, box.y + box.height + 20)).toEqual({
      lane: true,
      cursor: 'cell',
    });
  });

  test('says the body of a band moves it and its end resizes it', async ({ page }) => {
    const box = await boxOf(band(page, 2));
    const middle = box.x + box.width / 2;

    expect(await probe(page, middle, box.y + box.height / 2)).toMatchObject({ cursor: 'grab' });
    expect(await probe(page, middle, box.y + box.height - 3)).toMatchObject({ cursor: 'ns-resize' });
  });
});

const bands = (page: Page) => page.locator('[data-lane] [data-kind="row"]');

const band = (page: Page, index: number) => bands(page).nth(index);

const marked = (page: Page) => page.locator('[data-lane] [data-kind="row"][data-marked]');

const bar = (page: Page) => page.locator('[data-marked-bar]');

const mark = (target: Locator) => target.click({ modifiers: ['ControlOrMeta'] });

/**
 * Cuts a band in two through its own menu. The menu is waited out: it fades on its way off and stays
 * hit-testable while it does, so a probe that follows would read the overlay and not the grid.
 */
const splitInHalf = async (page: Page, target: Locator) => {
  await target.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Split in half' }).click();
  await expect(page.locator('et-menu')).toBeHidden();
};

const backgroundOf = (target: Locator) => target.evaluate((element) => getComputedStyle(element).backgroundColor);

const boxOf = async (target: Locator) => {
  const box = await target.boundingBox();

  if (!box) throw new Error('the band is not on the page');

  return box;
};

/** What the pointer would hit at a point, and the cursor it would wear there. */
const probe = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ atX, atY }) => {
      const element = document.elementFromPoint(atX, atY);

      if (!element) return null;

      return { lane: element.hasAttribute('data-lane'), cursor: getComputedStyle(element).cursor };
    },
    { atX: x, atY: y },
  );
