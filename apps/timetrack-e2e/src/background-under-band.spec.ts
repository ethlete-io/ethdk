import { Locator } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_ISSUE_KEY, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const WORKTREE = '/Users/e2e/dev/fut-frontend-altcha';
const BRANCH = 'fix/security-audit-general';
const DESCRIPTION = 'Show a paper plane';

const STAND_IN = {
  id: 'stand-in-bracket',
  name: 'Bracket challenge',
  state: 'open' as const,
  days: [],
  author: 'user' as const,
  createdAt: new Date(0),
};

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const sessionIn = (options: {
  cwd: string;
  branch: string;
  from: number;
  steps: number;
  title?: string;
}): CollectedEvent[] =>
  Array.from({ length: options.steps }, (_, step) => ({
    at: at(options.from + step * 5),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: `session-${options.cwd}-${options.branch}`,
    cwd: options.cwd,
    gitBranch: options.branch,
    title: options.title,
  }));

/**
 * A stand-in band in the main checkout, and a worktree session on an issue branch the band held every
 * minute of. The issue's lost stretch is drawn in the band's own lane, under the band.
 */
const seed = (page: import('@playwright/test').Page, options: { steps: number; lostFrom: number }) =>
  seedWorld(page, {
    now: E2E_NOW,
    events: [
      ...sessionIn({ cwd: E2E_REPO, branch: BRANCH, from: 0, steps: options.steps, title: DESCRIPTION }),
      ...sessionIn({
        cwd: WORKTREE,
        branch: E2E_ISSUE_BRANCH,
        from: options.lostFrom,
        steps: options.steps - options.lostFrom / 5,
      }),
    ],
    git: { extraRepos: [WORKTREE], worktrees: { [WORKTREE]: E2E_REPO } },
    settings: {
      ...defaultSettings(),
      standIns: [STAND_IN],
      attributionRules: [
        {
          id: 'rule-stand-in',
          repoPath: E2E_REPO,
          branch: BRANCH,
          target: { kind: 'stand-in' as const, standInId: STAND_IN.id },
          author: 'user' as const,
          createdAt: new Date(0),
        },
      ],
    },
  });

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('the line is not on screen');

  return box;
};

const intersects = (a: { y: number; height: number }, b: { y: number; height: number }) =>
  a.y < b.y + b.height && b.y < a.y + a.height;

const band = (page: import('@playwright/test').Page) => page.locator('[data-kind="row"][data-stand-in]');

const backgroundLines = (page: import('@playwright/test').Page) =>
  page.locator('[data-behind] span, [data-carried-behind]').filter({ hasText: `${E2E_ISSUE_KEY} · in the background` });

test.describe('a stand-in band drawn over a stretch a parallel session lost', () => {
  test('gives the background line its own line under the description', async ({ page }) => {
    await seed(page, { steps: 13, lostFrom: 15 });
    await page.goto('/day');

    await expect(band(page)).toHaveCount(1);
    await expect(backgroundLines(page)).toHaveCount(1);

    const description = await boxOf(band(page).getByText(DESCRIPTION, { exact: true }));
    const background = await boxOf(backgroundLines(page));

    expect(intersects(description, background)).toBe(false);
    expect(background.y).toBeGreaterThanOrEqual(description.y + description.height - 0.5);
  });

  test('drops the background line in a band with no room for it, rather than overlapping', async ({ page }) => {
    await seed(page, { steps: 7, lostFrom: 5 });
    await page.goto('/day');

    await expect(band(page)).toHaveCount(1);
    await expect(backgroundLines(page)).toHaveCount(0);
    await expect(page.locator('[data-behind]')).toHaveAttribute('title', `${E2E_ISSUE_KEY} · in the background · 30m`);
  });
});
