import { addAnEntry, expect, pickIssue, saveSurface, test } from './support';

test.describe('a row written on a day before today', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
    await page.getByRole('button', { name: 'Previous day' }).click();
  });

  test('is drawn on the day it was written on', async ({ page }) => {
    const surface = await addAnEntry(page);

    await pickIssue(page, surface, /ABC-2000/);
    await saveSurface(page);

    await expect(page.locator('[data-kind="row"]').filter({ hasText: 'by hand' })).toHaveCount(1);
  });
});
