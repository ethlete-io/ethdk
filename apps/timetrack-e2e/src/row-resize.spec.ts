import { Locator, Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** The seeded day's own morning, in the browser's pinned UTC. */
const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'invite.ts - fut-frontend - Visual Studio Code',
});

/** An hour on the quarters, so the band the reviewer grabs starts and ends on an hour rule. */
const anHour = (): CollectedEvent[] => [
  { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:00', '09:15', '09:30', '09:45', '10:00'].map(editing),
];

test.describe('a band dragged at both ends in turn', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: anHour() });
    await page.goto('/day');
  });

  test('keeps the end of the first drag while the second drag moves the start', async ({ page }) => {
    const row = band(page);

    await expect(row).toHaveAttribute('title', 'ABC-3010 · 1h 0m');

    const hour = await pxPerHour(page);

    await dragEdge({ page, row, edge: 'end', by: hour });
    await expect(row).toHaveAttribute('title', 'ABC-3010 · 2h 0m');

    await dragEdge({ page, row, edge: 'start', by: -hour });
    await expect(row).toHaveAttribute('title', 'ABC-3010 · 3h 0m');
  });

  test('keeps the start of the first drag while the second drag moves the end', async ({ page }) => {
    const row = band(page);

    await expect(row).toHaveAttribute('title', 'ABC-3010 · 1h 0m');

    const hour = await pxPerHour(page);

    await dragEdge({ page, row, edge: 'start', by: -hour });
    await expect(row).toHaveAttribute('title', 'ABC-3010 · 2h 0m');

    await dragEdge({ page, row, edge: 'end', by: hour });
    await expect(row).toHaveAttribute('title', 'ABC-3010 · 3h 0m');
  });
});

const band = (page: Page) => page.locator('[data-lane] [data-kind="row"]').first();

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('the element is not rendered');

  return box;
};

const pxPerHour = async (page: Page) => {
  const nine = await boxOf(page.locator('[data-hour="9"]'));
  const ten = await boxOf(page.locator('[data-hour="10"]'));

  return ten.y - nine.y;
};

/** Grabs the named end of a band and moves it `by` pixels down the column. */
const dragEdge = async (options: { page: Page; row: Locator; edge: 'start' | 'end'; by: number }) => {
  const { page, row, edge, by } = options;
  const box = await boxOf(row);
  const x = box.x + box.width / 2;
  const y = edge === 'start' ? box.y + 3 : box.y + box.height - 3;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + by, { steps: 10 });
  await page.mouse.up();
};
