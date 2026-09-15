import { Page } from '@playwright/test';
import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const ID = 'stand-in-ageing';

/** The keyless stretch of the fixture day, so the stand-in holds real time rather than none. */
const NAMES_THE_BRANCH = {
  id: 'rule-ageing',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: ID },
  author: 'user' as const,
  createdAt: new Date(0),
};

const standIn = (createdAt: string) => ({
  id: ID,
  name: 'The export nobody filed yet',
  state: 'open' as const,
  days: [E2E_DAY_KEY],
  author: 'user' as const,
  createdAt: new Date(createdAt),
});

const open = async (
  page: Page,
  options: { createdAt: string; overdueAfterWorkdays: number; overdueAfterMs: number },
) => {
  await seedWorld(page, {
    now: E2E_NOW,
    settings: {
      ...defaultSettings(),
      attributionRules: [NAMES_THE_BRANCH],
      standIns: [standIn(options.createdAt)],
      standIn: { overdueAfterWorkdays: options.overdueAfterWorkdays, overdueAfterMs: options.overdueAfterMs },
    },
  });
  await page.goto('/day');
  await page.locator('[data-waiting-on-a-ticket]').click();

  return page.locator(`[data-stand-in="${ID}"]`);
};

test.describe('a stand-in that has waited', () => {
  test('is left unmarked while it is inside both limits', async ({ page }) => {
    const card = await open(page, {
      createdAt: '2026-08-11T09:00:00.000Z',
      overdueAfterWorkdays: 5,
      overdueAfterMs: 0,
    });

    await expect(card).toContainText('1 workday');
    await expect(card.locator('[data-overdue]')).toHaveCount(0);
    await expect(page.locator('[data-waited-long-enough]')).toHaveCount(0);
  });

  test('is marked in the list and counted in the day header once it is too old', async ({ page }) => {
    const card = await open(page, {
      createdAt: '2026-08-03T09:00:00.000Z',
      overdueAfterWorkdays: 5,
      overdueAfterMs: 0,
    });

    await expect(card).toContainText('7 workdays');
    await expect(card.locator('[data-overdue]')).toBeVisible();
    await expect(page.locator('[data-waited-long-enough]')).toHaveText(/1 waited long enough/);
  });

  test('is marked for the time its own bands hold, however new it is', async ({ page }) => {
    const card = await open(page, {
      createdAt: '2026-08-11T09:00:00.000Z',
      overdueAfterWorkdays: 0,
      overdueAfterMs: 60_000,
    });

    await expect(card).toContainText('held');
    await expect(card.locator('[data-overdue]')).toBeVisible();
  });
});
