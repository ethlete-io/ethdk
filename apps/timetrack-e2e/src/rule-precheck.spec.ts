import { E2E_PARENT_KEY, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, editSurface, expect, openBand, seedWorld, test } from './support';

/**
 * A rule naming the whole checkout, which the day's second stretch falls through to: its branch
 * carries no key, so nothing above the rule can name it.
 */
const REPO_RULE = {
  id: 'rule-repo',
  repoPath: E2E_REPO,
  target: { kind: 'issue' as const, issueKey: E2E_PARENT_KEY },
  createdAt: new Date(0),
};

test.describe("a row the user's own rule named", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [REPO_RULE] },
    });
    await page.goto('/day');
  });

  test('is logged against the issue the rule names', async ({ page }) => {
    await expect(page.locator(`[data-kind="row"][title^="${E2E_PARENT_KEY}"]`)).toHaveCount(1);
  });

  test('arrives with its time already ticked for the sync, because the user wrote the rule', async ({ page }) => {
    await openBand(page, `${E2E_PARENT_KEY} · 1h 0m`);

    await expect(editSurface(page).getByRole('checkbox')).toBeChecked();
  });
});
