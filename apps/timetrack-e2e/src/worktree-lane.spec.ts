import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_ISSUE_KEY, E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const WORKTREE = '/Users/e2e/dev/fut-frontend-altcha';

/** Nine in the morning on the seeded day. The browser is pinned to UTC, so this is 09:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const sessionIn = (options: { cwd: string; branch: string; from?: number; steps?: number }): CollectedEvent[] =>
  Array.from({ length: options.steps ?? 13 }, (_, step) => ({
    at: at((options.from ?? 0) + step * 5),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: `session-${options.cwd}-${options.branch}`,
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
    await expect(page.locator('[data-lane] [data-kind="row"]')).toHaveCount(1);
  });

  test('draws in its main checkout’s lane rather than in one of its own', async ({ page }) => {
    const titles = await headers(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));

    expect(titles).toContain(`repo:${E2E_REPO}`);
    expect(titles).not.toContain(`repo:${WORKTREE}`);
  });

  test('books the hour the two shared once, as one row across the lane', async ({ page }) => {
    const titles = await headers(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
    const lane = page.locator('[data-lane]').nth(titles.indexOf(`repo:${E2E_REPO}`));
    const rows = lane.locator('[data-kind="row"]');

    await expect(rows).toHaveCount(1);
    await expect(rows).toHaveAttribute('title', /1h 0m$/);

    const laneBox = await boxOf(lane);
    const rowBox = await boxOf(rows);

    expect(rowBox.width).toBeGreaterThan(laneBox.width - 2);
  });
});

/** The worktree starts half an hour into the main checkout's hour, so the two overlap from 09:30 to 10:00. */
test.describe('a linked worktree that overlaps its main checkout for part of an hour', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [
        ...sessionIn({ cwd: E2E_REPO, branch: 'fix/security-audit-general' }),
        ...sessionIn({ cwd: WORKTREE, branch: 'feat/login-altcha', from: 30 }),
      ],
      git: { extraRepos: [WORKTREE], worktrees: { [WORKTREE]: E2E_REPO } },
    });
    await page.goto('/day');
    await expect(page.locator('[data-lane] [data-kind="row"]')).toHaveCount(2);
  });

  test('keeps only the minutes its main checkout did not hold, below it and across the lane', async ({ page }) => {
    const titles = await headers(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
    const lane = page.locator('[data-lane]').nth(titles.indexOf(`repo:${E2E_REPO}`));
    const main = lane.locator('[data-kind="row"]').first();
    const worktree = lane.locator('[data-kind="row"]').last();

    await expect(main).toHaveAttribute('title', /1h 0m$/);
    await expect(worktree).toHaveAttribute('title', /30m$/);

    const mainBox = await boxOf(main);
    const worktreeBox = await boxOf(worktree);

    expect(worktreeBox.y).toBeCloseTo(mainBox.y + mainBox.height, 0);
    expect(worktreeBox.x).toBeCloseTo(mainBox.x, 0);
    expect(worktreeBox.width).toBeCloseTo(mainBox.width, 0);
  });
});

/** The worktree runs only while its main checkout does, on a branch that names an issue. */
test.describe('a linked worktree its main checkout held every minute of', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [
        ...sessionIn({ cwd: E2E_REPO, branch: 'fix/security-audit-general' }),
        ...sessionIn({ cwd: WORKTREE, branch: E2E_ISSUE_BRANCH, from: 30, steps: 7 }),
      ],
      git: { extraRepos: [WORKTREE], worktrees: { [WORKTREE]: E2E_REPO } },
    });
    await page.goto('/day');
    await expect(page.locator('[data-lane] [data-kind="row"]')).toHaveCount(1);
  });

  test('books nothing, and says in the lane where its minutes went', async ({ page }) => {
    const titles = await headers(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
    const lane = page.locator('[data-lane]').nth(titles.indexOf(`repo:${E2E_REPO}`));

    await expect(lane.locator(`[data-kind="row"][title*="${E2E_ISSUE_KEY}"]`)).toHaveCount(0);
    await expect(lane.locator('[data-behind]')).toHaveAttribute('title', `${E2E_ISSUE_KEY} · in the background · 30m`);
  });
});
