import { expect, test } from './support';

const REMEMBERED_TOP = 321;

test.beforeEach(async ({ page }) => {
  await page.goto('/day');
});

test('keeps where the timeline was scrolled to across a reload', async ({ page }) => {
  const scroller = page.locator('[etSchedulerTimeGrid]');
  const row = page.locator('[data-kind="row"]').first();

  await expect(row).toBeVisible();
  await scroller.evaluate((element, top) => element.scrollTo({ top }), REMEMBERED_TOP);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('ethlete.timetrack.view-state') ?? '{}').timelineScroll),
    )
    .toEqual({ top: REMEMBERED_TOP, left: 0 });

  await page.reload();

  await expect(row).toBeVisible();
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(REMEMBERED_TOP);
});
