import { expect, test } from './support';

/**
 * The stamp is the app's own warning about itself: a worklog this build writes is real time on a real
 * issue, and the person reading the screen has to know how much to trust it. A build that quietly
 * stopped saying it is an alpha is what these runs catch.
 */
test.describe('the build stamp', () => {
  test('says the build is an early alpha where the app names itself', async ({ page }) => {
    await page.goto('/day');

    await expect(page.locator('[data-alpha-patch]')).toHaveText('Early alpha');
    await expect(page.locator('[data-build-label]')).toContainText('dev build');
  });

  test('keeps the app name reachable, now that the name is a logo', async ({ page }) => {
    await page.goto('/day');

    await expect(page.getByRole('img', { name: 'Timetrack' })).toBeVisible();
  });

  test('repeats the stamp on the screen a problem gets reported from', async ({ page }) => {
    await page.goto('/host');

    await expect(page.locator('[data-alpha-patch]')).toHaveCount(2);
  });
});
