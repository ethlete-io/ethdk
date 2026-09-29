import { E2E_KEYLESS_BRANCH, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, closeStandIns, expect, openStandIns, seedWorld, test } from './support';

const standIn = (options: { id: string; name: string; days: string[]; createdAt: string }) => ({
  ...options,
  state: 'open' as const,
  author: 'user' as const,
  openedFor: E2E_REPO,
  createdAt: new Date(options.createdAt),
});

const CURRENT = standIn({
  id: 'stand-in-current',
  name: 'Session pieces',
  days: [E2E_DAY_KEY],
  createdAt: '2026-07-10T09:00:00.000Z',
});
const OLDER = standIn({
  id: 'stand-in-older',
  name: 'Session join',
  days: ['2026-07-02'],
  createdAt: '2026-07-01T09:00:00.000Z',
});

const NAMES_THE_BRANCH = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'stand-in' as const, standInId: CURRENT.id },
  author: 'user' as const,
  createdAt: new Date(0),
};

test.describe('two open stand-ins of one checkout', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [NAMES_THE_BRANCH], standIns: [CURRENT, OLDER] },
    });
    await page.goto('/day');
  });

  test('join one into the other by hand, and the band takes the kept name', async ({ page }) => {
    const list = await openStandIns(page);

    await list
      .locator(`[data-stand-in="${CURRENT.id}"]`)
      .getByRole('button', { name: `Join into ${OLDER.name}` })
      .click();

    await expect(list.locator(`[data-stand-in="${CURRENT.id}"]`)).toHaveCount(0);
    await expect(list.locator(`[data-stand-in="${OLDER.id}"]`)).toContainText('2 days');
    await expect(list.getByRole('button', { name: /^Join into/ })).toHaveCount(0);

    await closeStandIns(page);

    await expect(page.locator(`[data-kind="row"][title^="${OLDER.name}"]`).first()).toBeVisible();
  });
});
