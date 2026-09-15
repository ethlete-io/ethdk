import { defaultSettings } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_NOW, expect, seedWorld, test } from './support';

const HELD = 'gitlab.braune-digital.com';

const openSources = async (page: Page) => {
  await page.goto('/day');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Sources' }).click();
};

/**
 * The instance is typed, and a typed host `glab` holds no credential for looks exactly like a working
 * setup on this screen. What `glab` is logged in to is the one thing that identifies the mistake.
 */
test.describe('the GitLab instance field', () => {
  test('offers what `glab` is logged in to when the field names another instance', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), gitlab: { host: 'trb@braune-digital.com' } },
      glab: { installed: true, logins: [{ host: HELD, login: 'bornholdt' }] },
    });
    await openSources(page);

    await page.locator('[data-glab-offers] button', { hasText: HELD }).click();

    await expect(page.locator('[data-glab-offers]')).toHaveCount(0);
  });

  test('offers it while the field is still empty, so the instance never has to be typed', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), gitlab: { host: '' } },
      glab: { installed: true, logins: [{ host: HELD, login: 'bornholdt' }] },
    });
    await openSources(page);

    await expect(page.locator('[data-glab-offers]')).toContainText(HELD);
  });

  test('stays quiet once the field and the login agree', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), gitlab: { host: HELD } },
      glab: { installed: true, logins: [{ host: HELD, login: 'bornholdt' }] },
    });
    await openSources(page);

    await expect(page.locator('[data-glab-offers]')).toHaveCount(0);
  });
});
