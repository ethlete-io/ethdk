import { E2E_NOW, expect, seedWorld, test } from './support';

test.describe('a Tempo history that cannot be read', () => {
  test('is named on the day screen', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, tempo: { readStatus: 401 } });
    await page.goto('/day');

    await expect(page.locator('[data-tempo-history-failed]')).toContainText('Tempo history could not be read');
  });

  test('says nothing when the history reads', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW });
    await page.goto('/day');

    await expect(page.locator('[data-kind="row"]').first()).toBeVisible();
    await expect(page.locator('[data-tempo-history-failed]')).toHaveCount(0);
  });
});
