import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_PARENT_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { Locator, Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, openDayNotes, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const editing = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'invite.ts - fut-frontend - Visual Studio Code',
});

const idle = (clock: string, kind: 'idle-start' | 'idle-end'): CollectedEvent => ({
  at: at(clock),
  source: 'idle',
  kind,
});

/** The day of `break-rounding.spec.ts`: two stretches of work with 1h 21m away between them. */
const aDayWithABreak = (): CollectedEvent[] => [
  { at: at('09:07'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_ISSUE_BRANCH },
  ...['09:07', '09:22', '09:37', '09:52', '10:07', '10:22'].map(editing),
  idle('10:22', 'idle-start'),
  idle('11:43', 'idle-end'),
  { at: at('11:43'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: E2E_PARENT_BRANCH },
  ...['11:43', '11:58', '12:13', '12:28', '12:43', '13:00'].map(editing),
];

const breaks = (page: Page) => page.locator('[data-break]');
const statements = (page: Page) => page.locator('[data-statement]');

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();

  if (!box) throw new Error('the element is not rendered');

  return box;
};

/** Draws a range down the break lane, from one whole hour to another. */
const drawBreak = async (options: { page: Page; from: number; to: number }) => {
  const { page, from, to } = options;
  const lane = await boxOf(page.locator('[data-lane]').first());
  const start = await boxOf(page.locator(`[data-hour="${from}"]`));
  const end = await boxOf(page.locator(`[data-hour="${to}"]`));
  const x = lane.x + lane.width / 2;

  await page.mouse.move(x, start.y);
  await page.mouse.down();
  await page.mouse.move(x, end.y, { steps: 10 });
  await page.mouse.up();
};

test.describe('a break the user says was time at the machine', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDayWithABreak() });
    await page.goto('/day');
  });

  test('is gone once the band is pressed, and the day says what was stated', async ({ page }) => {
    await expect(breaks(page)).toHaveCount(1);

    await breaks(page).first().click();

    await expect(breaks(page)).toHaveCount(0);

    await openDayNotes(page);

    await expect(statements(page)).toHaveCount(1);
    await expect(statements(page).first()).toContainText('you were here');
  });

  test('is drawn again once that statement is taken back', async ({ page }) => {
    await breaks(page).first().click();

    await openDayNotes(page);
    await page.locator('[data-statement-undo]').first().click();

    await expect(statements(page)).toHaveCount(0);
    await expect(breaks(page).first()).toHaveAttribute('title', '10:15 AM - 11:30 AM');
  });
});

test.describe('a stretch the user says they were away for', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDayWithABreak() });
    await page.goto('/day');
  });

  test('is drawn as a break, where the day measured none', async ({ page }) => {
    await expect(breaks(page)).toHaveCount(1);

    await drawBreak({ page, from: 14, to: 15 });

    await expect(breaks(page)).toHaveCount(2);
    await expect(breaks(page).nth(1)).toHaveAttribute('title', '02:00 PM - 03:00 PM');
  });

  test('holds even where the day already reads the stretch as work', async ({ page }) => {
    await drawBreak({ page, from: 9, to: 10 });

    await expect(breaks(page).first()).toHaveAttribute('title', '09:00 AM - 10:00 AM');
  });
});

const MINUTE_MS = 60_000;

const concurrency = (page: Page) => page.locator('footer [data-concurrency]');

const ratioOf = (text: string) => Number.parseFloat(text);

const durationPairMsOf = (text: string) => {
  const [first, second] = [...text.matchAll(/(?:(\d+)h )?(\d+)m/g)].map(
    (match) => (Number(match[1] ?? 0) * 60 + Number(match[2])) * MINUTE_MS,
  );

  if (first === undefined || second === undefined) throw new Error(`expected two durations in "${text}"`);

  return [first, second] as const;
};

test.describe("the day's present total", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: aDayWithABreak() });
    await page.goto('/day');
  });

  test('reads the engagement ratio against the presence a statement leaves', async ({ page }) => {
    const measured = ratioOf(await concurrency(page).innerText());

    await drawBreak({ page, from: 12, to: 13 });

    await expect.poll(async () => ratioOf(await concurrency(page).innerText())).toBeGreaterThan(measured);
  });

  test('keeps the measured total in the day notes, an hour above the stated one', async ({ page }) => {
    await drawBreak({ page, from: 12, to: 13 });
    await openDayNotes(page);

    const measured = page.locator('[data-statements-measured]');

    await expect(measured).toBeVisible();

    const [measuredMs, statedMs] = durationPairMsOf(await measured.innerText());

    expect(measuredMs - statedMs).toBe(60 * MINUTE_MS);
  });
});
