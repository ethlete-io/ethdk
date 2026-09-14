import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, editSurface, expect, openBand, readTray, seedWorld, test } from './support';

/** The name the user gave the work before Jira held a ticket for it. */
const STAND_IN = {
  id: 'stand-in-pdf',
  name: 'The export nobody filed yet',
  state: 'open' as const,
  days: [],
  author: 'user' as const,
  createdAt: new Date(0),
};

/** The keyless stretch of the fixture day, named by the stand-in rather than by a key. */
const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: STAND_IN.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

const seed = (page: import('@playwright/test').Page, standIns: (typeof STAND_IN)[]) =>
  seedWorld(page, {
    now: E2E_NOW,
    settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns },
  });

const band = (page: import('@playwright/test').Page) => page.locator(`[data-kind="row"][title^="${STAND_IN.name}"]`);

test.describe('a band a stand-in names', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, [STAND_IN]);
    await page.goto('/day');
  });

  test('reads as the name the user gave the work', async ({ page }) => {
    await expect(band(page)).toHaveCount(1);
  });

  test('is still not time a sync would write', async ({ page }) => {
    const title = await band(page).getAttribute('title');

    await openBand(page, title as string);

    await expect(editSurface(page).getByRole('checkbox')).not.toBeChecked();
  });

  test('is reported by the tray as waiting on a ticket', async ({ page }) => {
    await expect(band(page)).toHaveCount(1);
    await expect.poll(async () => (await readTray(page))?.total).toContain('waiting on a ticket');
  });
});

test.describe('a band whose stand-in the user deleted', () => {
  test('goes back to waiting for a name', async ({ page }) => {
    await seed(page, []);
    await page.goto('/day');

    await expect(band(page)).toHaveCount(0);
    await expect(page.locator('[data-kind="row"][title^="Not yet named"]')).not.toHaveCount(0);
  });
});
