import { Page } from '@playwright/test';
import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, seedWorld, test } from './support';

/** The checkout is work and files its tickets in ABC. Nothing yet says which issue that work is. */
const LINKS_THE_CHECKOUT = {
  id: 'link-fut',
  path: E2E_REPO,
  target: { kind: 'project' as const, projectKey: 'ABC' },
  createdAt: new Date(0),
};

const band = (page: Page) => page.locator('[data-kind="row"][data-stand-in]');

const openList = async (page: Page) => {
  await page.locator('[data-waiting-on-a-ticket]').click();
  await expect(page.locator('ethlete-stand-ins')).toBeVisible();
};

test.describe('a linked checkout Jira holds no ticket for', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), projectLinks: [LINKS_THE_CHECKOUT] },
    });
    await page.goto('/day');
  });

  test('opens its own stand-in without being asked for one', async ({ page }) => {
    await expect(page.locator('[data-waiting-on-a-ticket]')).toHaveText(/1 waiting on a ticket/);
  });

  test('draws the band as work that is named and still waiting', async ({ page }) => {
    await expect(band(page)).toHaveCount(1);
    await expect(band(page)).toHaveAttribute('title', /Pdf export/);
    await expect(band(page)).toHaveClass(/et-color--pending/);
  });

  test('names it from the branch and says in the list what it drew on', async ({ page }) => {
    await openList(page);

    const card = page.locator('ethlete-stand-ins [data-stand-in]').first();

    await expect(card).toContainText('Pdf export');
  });
});

test.describe('a checkout no link covers', () => {
  test('opens nothing, and the day keeps asking about it', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: defaultSettings() });
    await page.goto('/day');

    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).not.toHaveCount(0);
    await expect(page.locator('[data-waiting-on-a-ticket]')).toHaveCount(0);
  });
});
