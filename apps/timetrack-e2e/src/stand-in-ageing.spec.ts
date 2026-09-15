import { Page } from '@playwright/test';
import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, closeStandIns, expect, openStandIns, seedWorld, test } from './support';

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

const seed = async (
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
};

const openList = async (page: Page) => {
  await openStandIns(page);

  return page.locator(`[data-stand-in="${ID}"]`);
};

const open = async (
  page: Page,
  options: { createdAt: string; overdueAfterWorkdays: number; overdueAfterMs: number },
) => {
  await seed(page, options);

  return openList(page);
};

const field = (page: Page, label: string) => page.locator('et-form-field').filter({ hasText: label });

/** Scoped to the rail: the end-of-day reminder offers a link to the day as well. */
const goTo = (page: Page, view: 'Day' | 'Settings') =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: view }).click();

/** Inside both limits when the screen opens, so a mark can only come from the control that was used. */
const YOUNG = { createdAt: '2026-08-11T09:00:00.000Z', overdueAfterWorkdays: 5, overdueAfterMs: 0 };

test.describe('a stand-in that has waited', () => {
  test('is left unmarked while it is inside both limits', async ({ page }) => {
    const card = await open(page, {
      createdAt: '2026-08-11T09:00:00.000Z',
      overdueAfterWorkdays: 5,
      overdueAfterMs: 0,
    });

    await expect(card).toContainText('1 workday');
    await expect(card.locator('[data-overdue]')).toHaveCount(0);
  });

  test('is marked in the list once it is too old', async ({ page }) => {
    const card = await open(page, {
      createdAt: '2026-08-03T09:00:00.000Z',
      overdueAfterWorkdays: 5,
      overdueAfterMs: 0,
    });

    await expect(card).toContainText('7 workdays');
    await expect(card.locator('[data-overdue]')).toBeVisible();
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

test.describe('the ageing limits on the settings screen', () => {
  test('marks the stand-in once the workday limit is lowered to reach it', async ({ page }) => {
    await seed(page, YOUNG);

    await expect((await openList(page)).locator('[data-overdue]')).toHaveCount(0);
    await closeStandIns(page);

    await goTo(page, 'Settings');
    await field(page, 'Older than').locator('et-select').click();
    await page.getByRole('option', { name: '1 workday', exact: true }).click();
    await goTo(page, 'Day');

    await expect((await openList(page)).locator('[data-overdue]')).toBeVisible();
  });

  test('marks the stand-in once the held-time limit is lowered to reach it', async ({ page }) => {
    await seed(page, YOUNG);

    await expect((await openList(page)).locator('[data-overdue]')).toHaveCount(0);
    await closeStandIns(page);

    await goTo(page, 'Settings');
    const holding = field(page, 'Or holding').locator('.et-duration-input-field');

    await holding.fill('00:01');
    await holding.press('Enter');
    await goTo(page, 'Day');

    await expect((await openList(page)).locator('[data-overdue]')).toBeVisible();
  });

  test('keeps a limit a hand edit put outside the ladder, rather than reading blank', async ({ page }) => {
    await seed(page, { ...YOUNG, overdueAfterWorkdays: 7 });
    await goTo(page, 'Settings');

    await expect(field(page, 'Older than').locator('et-select')).toContainText('7 workdays');
  });
});
