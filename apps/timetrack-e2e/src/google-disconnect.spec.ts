import { TIMETRACK_SECRET_KEYS } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_NOW, expect, readBackend, seedWorld, test } from './support';

const card = (page: Page) => page.locator('ethlete-google-connection');

/** The Google card sits on the sources tab, which the settings screen does not open on. */
const openCard = async (page: Page) => {
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Sources' }).click();
  await expect(card(page)).toBeVisible();
};

const badge = (page: Page) => card(page).locator('et-badge');

const button = (page: Page, name: string) => card(page).getByRole('button', { name });

/** A seed the Google card reads as connected: a client id in the settings, both secrets in the keychain. */
const connected = () => {
  const settings = defaultSettings();

  return {
    now: E2E_NOW,
    settings: { ...settings, google: { ...settings.google, clientId: 'e2e.apps.googleusercontent.com' } },
    secrets: {
      [TIMETRACK_SECRET_KEYS.googleClientSecret]: 'e2e-google-secret',
      [TIMETRACK_SECRET_KEYS.googleRefreshToken]: '1//e2e-refresh',
    },
  };
};

const refusing = () => ({ ...connected(), faults: [{ url: 'oauth2.googleapis.com/revoke', status: 500 }] });

/**
 * Disconnecting is the one action whose whole point is outside this machine. A local delete that
 * reports success leaves the grant standing at Google, and nothing on the screen says so.
 */
test.describe('disconnecting the google account', () => {
  test('withdraws the grant at google, then forgets the token', async ({ page }) => {
    await seedWorld(page, connected());
    await openCard(page);

    await button(page, 'Disconnect').click();

    await expect(badge(page)).toHaveText('not connected');

    const backend = await readBackend(page);

    expect(backend.requests.filter((request) => request.url.includes('/revoke'))).toHaveLength(1);
  });

  test('keeps the account when google refuses, rather than reporting a disconnect', async ({ page }) => {
    await seedWorld(page, refusing());
    await openCard(page);

    await button(page, 'Disconnect').click();

    await expect(card(page)).toContainText('Google did not confirm the disconnect');
    await expect(badge(page)).toHaveText('connected');
    await expect(button(page, 'Disconnect')).toBeVisible();
  });

  test('removes the token on this machine only when the user asks for that', async ({ page }) => {
    await seedWorld(page, refusing());
    await openCard(page);

    await button(page, 'Disconnect').click();
    await button(page, 'Remove from this machine').click();

    await expect(badge(page)).toHaveText('not connected');
  });
});
