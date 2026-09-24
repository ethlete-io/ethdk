import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const WORKTREE = '/Users/e2e/dev/fut-frontend-altcha';

/** Nine in the morning on the seeded day. The browser is pinned to UTC, so this is 09:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const sessionIn = (options: { cwd: string; branch: string }): CollectedEvent[] =>
  Array.from({ length: 13 }, (_, step) => ({
    at: at(step * 5),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: `session-${options.cwd}`,
    cwd: options.cwd,
    gitBranch: options.branch,
  }));

/** One hour two agents worked at once: one in the main checkout, one in a worktree linked to it. */
const EVENTS: CollectedEvent[] = [
  ...sessionIn({ cwd: E2E_REPO, branch: 'fix/security-audit-general' }),
  ...sessionIn({ cwd: WORKTREE, branch: 'feat/login-altcha' }),
];

const headers = (page: Page) => page.locator('[data-lane-header]');

const boxOf = async (row: ReturnType<Page['locator']>) => {
  const box = await row.boundingBox();

  if (!box) throw new Error('the row is not on screen');

  return box;
};

test.describe('a linked worktree that worked beside its main checkout', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: EVENTS,
      git: { extraRepos: [WORKTREE], worktrees: { [WORKTREE]: E2E_REPO } },
    });
    await page.goto('/day');
    await expect(page.locator('[data-lane] [data-kind="row"]')).toHaveCount(2);
  });

  test('draws in its main checkout’s lane rather than in one of its own', async ({ page }) => {
    const titles = await headers(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));

    expect(titles).toContain(`repo:${E2E_REPO}`);
    expect(titles).not.toContain(`repo:${WORKTREE}`);
  });

  test('puts the two checkouts’ rows side by side in that lane', async ({ page }) => {
    const titles = await headers(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
    const lane = page.locator('[data-lane]').nth(titles.indexOf(`repo:${E2E_REPO}`));
    const rows = lane.locator('[data-kind="row"]');

    await expect(rows).toHaveCount(2);

    const first = await boxOf(rows.first());
    const second = await boxOf(rows.last());

    expect(Math.abs(second.x - first.x)).toBeGreaterThan(first.width / 2);
    expect(second.width).toBeCloseTo(first.width, 0);
  });
});
