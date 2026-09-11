import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  expect,
  openBand,
  readBackend,
  saveSurface,
  seedWorld,
  setLogged,
  test,
} from './support';

/** The seeded day's own morning, in the browser's pinned UTC. */
const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'invite.ts - fut-frontend - Visual Studio Code',
});

/**
 * A morning that starts and ends between the quarters: the checkout at 09:07 and the last sample at
 * 10:22. Nothing in it sits on a boundary, so every clock time the app shows for it is one the
 * rounding put there.
 */
const offGrid = (): CollectedEvent[] => [
  { at: at('09:07'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:07', '09:22', '09:37', '09:52', '10:07', '10:22'].map(editing),
];

test.describe('a row between the quarters', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: offGrid() });
    await page.goto('/day');
  });

  test('books the whole increments the morning reached into', async ({ page }) => {
    await expect(page.locator('[data-kind="row"]').first()).toHaveAttribute('title', 'ABC-3010 · 1h 15m');
  });

  test('writes a start on the quarter, not the minute the checkout happened', async ({ page }) => {
    await openBand(page, 'ABC-3010 · 1h 15m');
    await setLogged(page, true);
    await saveSurface(page);

    await page.getByRole('link', { name: 'Sync' }).click();
    await page.getByRole('button', { name: 'Plan this day' }).click();
    await page.getByRole('button', { name: 'Write 1 change to Tempo' }).click();

    await expect(page.getByRole('heading', { name: 'Last write' })).toBeVisible();

    const backend = await readBackend(page);

    expect(backend.tempo.worklogs).toEqual([
      expect.objectContaining({ startDate: E2E_DAY_KEY, startTime: '09:00:00', timeSpentSeconds: 4500 }),
    ]);
  });
});
