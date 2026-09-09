import { Page } from '@playwright/test';
import { E2E_NOW, expect, seedWorld, test } from './support';

const row = (page: Page, id: string) => page.locator(`[data-source="${id}"]`);

/**
 * The inventory's states are the app's claim about what reaches the database, so a badge that reads
 * `collecting` for a source the host is not watching is the one wrong answer this screen can give.
 * The fake host watches no window and no microphone, which is the shape a platform with no
 * implementation of either has.
 */
test.describe('the sources screen', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW });
    await page.goto('/sources');
  });

  test('says a source the host is not watching is not running', async ({ page }) => {
    await expect(row(page, 'call')).toContainText('not running');
    await expect(row(page, 'call')).not.toContainText('collecting');
  });

  test('says it of every source the host reports none for, not only the call source', async ({ page }) => {
    await expect(row(page, 'window')).toContainText('not running');
    await expect(row(page, 'vscode')).toContainText('not running');
  });

  test('leaves a source the host reports no status for collecting', async ({ page }) => {
    await expect(row(page, 'git')).toContainText('collecting');
  });

  test('still reads as planned for a source nobody built', async ({ page }) => {
    await expect(row(page, 'slack')).toContainText('planned');
  });
});
