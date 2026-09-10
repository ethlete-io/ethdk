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

test.describe('a row taken off the timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');

    const surface = await addAnEntry(page);

    await pickIssue(page, surface, /ABC-2000/);
    await saveSurface(page);
    await hideTheBand(page);
  });

  test('takes the band off the timeline and says where its time went', async ({ page }) => {
    await expect(manualBand(page)).toHaveCount(0);
    await expect(page.locator('[data-hidden] summary')).toContainText('1 row(s)');
  });

  test('puts the band back where it was', async ({ page }) => {
    await page.locator('[data-hidden] summary').click();
    await page.getByRole('button', { name: 'Put back' }).click();

    await expect(manualBand(page)).toHaveCount(1);
    await expect(page.locator('[data-hidden]')).toHaveCount(0);
  });
});

test.describe("the band's own menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');

    const surface = await addAnEntry(page);

    await pickIssue(page, surface, /ABC-2000/);
    await saveSurface(page);
  });

  test('hides the row a right click was aimed at', async ({ page }) => {
    await manualBand(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Hide this row' }).click();

    await expect(manualBand(page)).toHaveCount(0);
    await expect(page.locator('[data-hidden] summary')).toContainText('1 row(s)');
  });

  test('cuts the row a right click was aimed at in two', async ({ page }) => {
    const bands = page.locator('[data-kind="row"]');
    const before = await bands.count();

    await manualBand(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Split in half' }).click();

    await expect(bands).toHaveCount(before + 1);
  });
});

test.describe('bands marked to be merged', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');

    const surface = await addAnEntry(page);

    await pickIssue(page, surface, /ABC-2000/);
    await saveSurface(page);

    await manualBand(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Split in half' }).click();
    await expect(halves(page)).toHaveCount(2);
  });

  test('marks a band a modifier click landed on rather than opening it', async ({ page }) => {
    await halves(page)
      .first()
      .click({ modifiers: ['Control'] });

    await expect(halves(page).first()).toHaveAttribute('data-marked', 'true');
    await expect(editSurface(page)).toHaveCount(0);
  });

  test('folds the marked bands back into one row', async ({ page }) => {
    await halves(page)
      .first()
      .click({ modifiers: ['Control'] });
    await halves(page)
      .last()
      .click({ modifiers: ['Control'] });

    await halves(page).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Merge the 2 marked rows' }).click();

    await expect(halves(page)).toHaveCount(1);
  });

  test('offers no merge until two bands are marked', async ({ page }) => {
    await halves(page)
      .first()
      .click({ modifiers: ['Control'] });
    await halves(page).first().click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: /Merge the/ })).toHaveCount(0);
  });
});

/** The two bands one cut of the hand-written row left, which both still name its issue. */
const halves = (page: Page) => page.locator('[data-kind="row"]').filter({ hasText: 'ABC-2000' });

const hideTheBand = async (page: Page) => {
  const title = await manualBand(page).getAttribute('title');

  await openBand(page, title ?? '');
  await editSurface(page).getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Hide this row' }).click();
};

/** The band's own label is what tells a hand-written row from a reconstructed one in the DOM. */
const manualBand = (page: Page) => page.locator('[data-kind="row"]').filter({ hasText: 'by hand' });
