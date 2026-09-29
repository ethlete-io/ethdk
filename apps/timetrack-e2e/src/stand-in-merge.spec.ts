import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, closeStandIns, expect, openStandIns, seedWorld, test } from './support';

const NAME = 'Competition journey overlay';

const standIn = (id: string, days: string[], createdAt: string) => ({
  id,
  name: NAME,
  state: 'open' as const,
  days,
  author: 'user' as const,
  createdAt: new Date(createdAt),
});

const CURRENT = standIn('stand-in-current', [E2E_DAY_KEY], '2026-07-10T09:00:00.000Z');
const OLDER = standIn('stand-in-older', ['2026-07-02'], '2026-07-01T09:00:00.000Z');

const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: CURRENT.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

test.describe('two open stand-ins with one name', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [CURRENT, OLDER] },
    });
    await page.goto('/day');
  });

  test('merge into one, and the band keeps the name', async ({ page }) => {
    const list = await openStandIns(page);

    await list
      .locator(`[data-stand-in="${CURRENT.id}"]`)
      .getByRole('button', { name: /^Merge into the other/ })
      .click();

    await expect(list.locator(`[data-stand-in="${CURRENT.id}"]`)).toHaveCount(0);
    await expect(list.locator(`[data-stand-in="${OLDER.id}"]`)).toContainText('2 days');
    await expect(list.getByRole('button', { name: /^Merge into the other/ })).toHaveCount(0);

    await closeStandIns(page);

    await expect(page.locator(`[data-kind="row"][title^="${NAME}"]`).first()).toBeVisible();
  });
});
