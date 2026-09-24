import { Page } from '@playwright/test';
import { E2E_DAY_KEY, expect, test } from './support';

const REMEMBERED_TOP = 321;
const OTHER_DAY_TOP = 123;

const scroller = (page: Page) => page.locator('[etSchedulerTimeGrid]');

const rememberedScrolls = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ethlete.timetrack.view-state') ?? '{}').timelineScroll);

const scrollTo = async (page: Page, top: number) => {
  await scroller(page).evaluate((element, to) => element.scrollTo({ top: to }), top);
};

test.beforeEach(async ({ page }) => {
  await page.goto('/day');
  await expect(page.locator('[data-kind="row"]').first()).toBeVisible();
});

test('keeps where the timeline was scrolled to across a reload', async ({ page }) => {
  await scrollTo(page, REMEMBERED_TOP);
  await expect.poll(() => rememberedScrolls(page)).toEqual({ [E2E_DAY_KEY]: { top: REMEMBERED_TOP, left: 0 } });

  await page.reload();

  await expect(page.locator('[data-kind="row"]').first()).toBeVisible();
  await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(REMEMBERED_TOP);
});

test('keeps a scroll position per day', async ({ page }) => {
  await scrollTo(page, REMEMBERED_TOP);
  await expect.poll(async () => (await rememberedScrolls(page))?.[E2E_DAY_KEY]?.top).toBe(REMEMBERED_TOP);

  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.locator('[data-kind="row"]')).toHaveCount(0);
  await scroller(page).dispatchEvent('wheel');
  await scrollTo(page, OTHER_DAY_TOP);
  await expect.poll(async () => Object.keys((await rememberedScrolls(page)) ?? {}).length).toBe(2);

  await page.getByRole('button', { name: 'Next day' }).click();

  await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(REMEMBERED_TOP);
});
