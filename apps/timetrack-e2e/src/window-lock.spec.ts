import { E2E_NOW, expect, readTray, seedWorld, test } from './support';

/**
 * The tray menu is drawn by the desktop, outside the window the lock covers, and it keeps whatever was
 * last written into it. So a window that locks without rewriting the tray leaves the day - the issue,
 * the hours - readable by anybody who walks up to the machine.
 */
test.describe('the tray while the window is locked', () => {
  const lockTheWindow = async (page: import('@playwright/test').Page) => {
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });

    await page.getByRole('tab', { name: 'Sources' }).click();
    await page.getByRole('button', { name: 'Lock now' }).click();
  };

  test('reports the day while the window is open', async ({ page }) => {
    await page.goto('/day');

    await expect.poll(async () => (await readTray(page))?.total).toContain('target');
  });

  test('says only that it is locked once the window locks', async ({ page }) => {
    await page.goto('/day');
    await expect.poll(async () => (await readTray(page))?.total).toContain('target');

    await lockTheWindow(page);

    await expect.poll(async () => (await readTray(page))?.activity).toBe('Locked');
  });

  test('names neither the work nor the hours once the window locks', async ({ page }) => {
    await page.goto('/day');
    await expect.poll(async () => (await readTray(page))?.total).toContain('target');

    await lockTheWindow(page);
    await expect.poll(async () => (await readTray(page))?.activity).toBe('Locked');

    const tray = await readTray(page);

    expect(tray?.total).not.toContain('target');
    expect(tray?.timer).not.toContain('—');
    expect(tray?.pause).not.toContain('paused');
  });
});

/**
 * The lock is the only thing between somebody at the machine and the day. A read of it that failed
 * says nothing about whether the window is locked, so a window that treats the failure as "unlocked"
 * hands the day to whoever made the read fail.
 */
test.describe('a window lock the host did not answer for', () => {
  test('shows the day when the host answers', async ({ page }) => {
    await page.goto('/day');

    await expect(page.getByRole('heading', { name: 'Locked' })).toHaveCount(0);
  });

  test('stays locked rather than falling open', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, windowLock: 'unreachable' });
    await page.goto('/day');

    await expect(page.getByRole('heading', { name: 'Locked' })).toBeVisible();
  });

  test('says why the lock could not be read', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, windowLock: 'unreachable' });
    await page.goto('/day');

    await expect(page.getByText('the host did not answer')).toBeVisible();
  });
});
