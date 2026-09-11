import { Locator } from '@playwright/test';
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

/**
 * The clock the timeline draws, as against the clock a row stores. A band is placed by a percentage
 * of the day column, and an hour rule by a rem offset into the same column, so the two can disagree
 * without either number being wrong on its own. This reads both off the rendered page.
 */
test.describe('the band a row draws', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: offGrid() });
    await page.goto('/day');
  });

  test('starts on the hour rule it is logged against', async ({ page }) => {
    const band = await boxOf(page.locator('[data-kind="row"][title="ABC-3010 · 1h 15m"]'));
    const nine = await boxOf(page.locator('[data-hour="9"]'));
    const ten = await boxOf(page.locator('[data-hour="10"]'));
    const pxPerHour = ten.y - nine.y;

    expect(pxPerHour).toBeGreaterThan(0);
    expect(Math.abs(band.y - nine.y)).toBeLessThan(1.5);
    expect(Math.abs(band.y + band.height - (ten.y + pxPerHour / 4))).toBeLessThan(1.5);
  });
});

/** A morning of a few minutes, which books the one increment it reached into and no more. */
const aShortMorning = (): CollectedEvent[] => [
  { at: at('09:07'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:07', '09:12'].map(editing),
];

test.describe('a band one increment tall', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aShortMorning() });
    await page.goto('/day');
  });

  /**
   * 2rem at `HOUR_REM`, which is one padded line of `text-small` short of fitting its label. Without
   * the compact tier the band renders as a bare bar and the only place it reads is its hover title.
   */
  test('reads as itself rather than as a bar with a hover title', async ({ page }) => {
    const band = page.locator('[data-kind="row"][data-compact]').first();

    await expect(band).toBeVisible();
    await expect(band).toContainText('ABC-3010');
  });
});

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('the element is not rendered');

  return box;
};
