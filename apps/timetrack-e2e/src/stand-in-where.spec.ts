import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, openStandIns, seedWorld, test } from './support';

const named = (options: { id: string; openedFor: string; openedForBranch?: string; openedForWorkPath?: string }) => ({
  ...options,
  name: 'Competition journey overlay',
  state: 'open' as const,
  days: [E2E_DAY_KEY],
  author: 'app' as const,
  createdAt: new Date('2026-08-11T09:00:00.000Z'),
});

const SPEC = named({
  id: 'stand-in-spec',
  openedFor: '/home/tom/dev/fifagg/specs',
  openedForBranch: 'main',
  openedForWorkPath: 'context/tracks/20260911_competition-journey-overlay',
});

const BRANCH = named({
  id: 'stand-in-branch',
  openedFor: '/home/tom/dev/fifagg-frontend',
  openedForBranch: 'feature/20260911_competition-journey-overlay',
});

const BY_HAND = {
  id: 'stand-in-by-hand',
  name: 'Competition journey overlay',
  state: 'open' as const,
  days: [E2E_DAY_KEY],
  author: 'user' as const,
  createdAt: new Date('2026-08-11T09:00:00.000Z'),
};

/** `withoutOrphanedStandIns` sweeps an app-opened record no rule names, so each one gets its own. */
const namesIt = (standIn: { id: string; openedFor: string }) => ({
  id: `rule-${standIn.id}`,
  repoPath: standIn.openedFor,
  target: { kind: 'stand-in' as const, standInId: standIn.id },
  author: 'app' as const,
  createdAt: new Date('2026-08-11T09:00:00.000Z'),
});

test.describe('two stand-ins that carry one name', () => {
  test('each says which checkout and which piece of it the name stands for', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: {
        ...defaultSettings(),
        attributionRules: [namesIt(SPEC), namesIt(BRANCH)],
        standIns: [SPEC, BRANCH, BY_HAND],
      },
    });
    await page.goto('/day');
    await openStandIns(page);

    await expect(page.locator(`[data-stand-in="${SPEC.id}"]`)).toContainText(
      'specs, context/tracks/20260911_competition-journey-overlay',
    );
    await expect(page.locator(`[data-stand-in="${BRANCH.id}"]`)).toContainText(
      'fifagg-frontend, on feature/20260911_competition-journey-overlay',
    );
    await expect(page.locator(`[data-stand-in="${BY_HAND.id}"]`)).not.toContainText('fifagg');
  });
});
