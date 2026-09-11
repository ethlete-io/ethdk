import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'invite.ts - fut-frontend - Visual Studio Code',
});

/**
 * One checkout, worked on `next` for half an hour and then on the branch that names the issue. This
 * is what an agent does to itself: it starts where it was, then creates the branch for the work.
 */
const swap = (): CollectedEvent[] => [
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: 'next' },
  ...['09:00', '09:15', '09:30'].map(editing),
  { at: at('09:30'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:45', '10:00'].map(editing),
];

test.describe('a checkout that swapped to the branch naming its issue', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: swap() });
    await page.goto('/day');
  });

  test('draws one band, under the issue the later branch names', async ({ page }) => {
    const rows = page.locator('[data-lane] [data-kind="row"]');

    await expect(rows).toHaveCount(1);
    await expect(rows).toHaveAttribute('title', 'ABC-3010 · 1h 0m');
  });

  test('describes itself by the branch that names the issue, not the one it left', async ({ page }) => {
    await expect(page.locator('[data-lane] [data-kind="row"]')).toContainText('user management');
  });

  test('marks inside the band where the checkout swapped, and names both branches', async ({ page }) => {
    const mark = page.locator('[data-kind="row"] [data-swap]');

    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveAttribute('title', `30m on \`next\` before it swapped to \`${E2E_ISSUE_BRANCH}\``);
  });
});
