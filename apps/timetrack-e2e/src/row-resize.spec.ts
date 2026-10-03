import { Locator, Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_BRANCH, E2E_REPO } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, editSurface, expect, seedWorld, test } from './support';

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

test.describe('one part of a split band dragged at an end', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: anHour() });
    await page.goto('/day');
    await band(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Split in half' }).click();
    await expect(page.locator('et-menu')).toBeHidden();
    await expect(bands(page)).toHaveCount(2);
  });

  test('keeps its own start while its end grows', async ({ page }) => {
    const hour = await pxPerHour(page);

    await dragEdge({ page, row: bands(page).last(), edge: 'end', by: hour / 2 });

    await expect(bands(page).last()).toHaveAttribute('title', 'ABC-3010 · 1h 0m');
    await expect(bands(page).first()).toHaveAttribute('title', 'ABC-3010 · 30m');
  });

  test('leaves the stretch it gave up empty when its end shrinks', async ({ page }) => {
    const hour = await pxPerHour(page);

    await dragEdge({ page, row: bands(page).last(), edge: 'end', by: -hour / 4 });

    await expect(bands(page).last()).toHaveAttribute('title', 'ABC-3010 · 15m');
    await expect(bands(page)).toHaveCount(2);
  });

  test('leaves the stretch it gave up empty when its start shrinks', async ({ page }) => {
    const hour = await pxPerHour(page);

    await dragEdge({ page, row: bands(page).last(), edge: 'start', by: hour / 4, inset: 8 });

    await expect(bands(page).last()).toHaveAttribute('title', 'ABC-3010 · 15m');
    await expect(bands(page)).toHaveCount(2);
  });
});

test.describe('a band opened from the keyboard after a drag', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: anHour() });
    await page.goto('/day');
  });

  for (const key of ['Enter', 'Space']) {
    test(`opens its edit surface on ${key}`, async ({ page }) => {
      const row = band(page);

      await dragEdge({ page, row, edge: 'end', by: await pxPerHour(page) });
      await expect(row).toHaveAttribute('title', 'ABC-3010 · 2h 0m');
      await expect(editSurface(page)).toBeHidden();

      await row.focus();
      await page.keyboard.press(key);

      await expect(editSurface(page)).toBeVisible();
    });
  }
});

/**
 * The desktop app runs in WebKitGTK, which ignores the unprefixed `user-select` a drag sets on the
 * document to stop a selection. The spec takes that property away from Chromium to match.
 */
test.describe('a band resized where the unprefixed user-select is ignored', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(CSSStyleDeclaration.prototype, 'userSelect', {
        configurable: true,
        get: () => '',
        set: () => undefined,
      }),
    );
    await seedWorld(page, { now: E2E_NOW, events: anHour() });
    await page.goto('/day');
  });

  test('resizes, and selects no text along the way', async ({ page }) => {
    const row = band(page);

    await expect(row).toHaveAttribute('title', 'ABC-3010 · 1h 0m');

    const hour = await pxPerHour(page);
    const box = await boxOf(row);
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 3;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - hour / 2, { steps: 10 });

    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('');

    await page.mouse.up();

    await expect(row).toHaveAttribute('title', 'ABC-3010 · 30m');
  });
});

const bands = (page: Page) => page.locator('[data-lane] [data-kind="row"]');

const band = (page: Page) => bands(page).first();

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
const dragEdge = async (options: { page: Page; row: Locator; edge: 'start' | 'end'; by: number; inset?: number }) => {
  const { page, row, edge, by, inset = 3 } = options;
  const box = await boxOf(row);
  const x = box.x + box.width / 2;
  const y = edge === 'start' ? box.y + inset : box.y + box.height - inset;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + by, { steps: 10 });
  await page.mouse.up();
};
