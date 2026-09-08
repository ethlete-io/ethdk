import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, settle } from '../support';

const DEFAULT_ID = 'components-sports-standings-pick--default';
const LOCKED_ID = 'components-sports-standings-pick--locked';
const NO_CUT_ID = 'components-sports-standings-pick--no-cut';

function names(root: Locator): Locator {
  return root.locator('.et-standings-pick-list .et-match-participant-name');
}

function handles(root: Locator): Locator {
  return root.locator('.et-standings-pick-handle');
}

/** `order` with the entries at `a` and `b` exchanged, trimmed for a `toHaveText` comparison. */
function swapped(order: string[], a: number, b: number): string[] {
  const next = [...order];

  [next[a], next[b]] = [next[b] ?? '', next[a] ?? ''];

  return next.map((name) => name.trim());
}

/** The 0-based row the cut is drawn under, or `-1` when the list draws none. */
async function cutAfter(root: Locator): Promise<number> {
  return root
    .locator('.et-standings-pick-item')
    .evaluateAll((items) => items.findIndex((item) => !!item.querySelector('.et-standings-pick-cut')));
}

test.describe('standings pick / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard reordering');

  test('Tab reaches the first row control and its focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(handles(root).first());
  });

  test('the row control names the participant and both ways to sort it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const first = await names(root).first().innerText();

    await expect(handles(root).first()).toHaveAttribute(
      'aria-label',
      `Move ${first.trim()}. Drag it, or use the arrow keys.`,
    );
  });

  test('ArrowDown moves the row down and ArrowUp puts it back', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const before = await names(root).allInnerTexts();

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');

    await expect(names(root)).toHaveText(swapped(before, 0, 1));

    await pressKey(page, 'ArrowUp');

    await expect(names(root)).toHaveText(before.map((name) => name.trim()));
  });

  test('focus stays on the control of the row it moved', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');

    const label = await handles(root).first().getAttribute('aria-label');

    await pressKey(page, 'ArrowDown');

    await expect(handles(root).nth(1)).toBeFocused();
    await expect(handles(root).nth(1)).toHaveAttribute('aria-label', label ?? '');
  });

  test('ArrowUp on the first row leaves the order alone', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const before = await names(root).allInnerTexts();

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowUp');
    await settle(page, 100);

    await expect(names(root)).toHaveText(before.map((name) => name.trim()));
  });

  test('ArrowDown on the last row leaves the order alone', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const before = await names(root).allInnerTexts();
    const count = await handles(root).count();

    await handles(root)
      .nth(count - 1)
      .focus();
    await pressKey(page, 'ArrowDown');
    await settle(page, 100);

    await expect(names(root)).toHaveText(before.map((name) => name.trim()));
  });

  test('a row carried across the cut takes the cut label with it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    expect(await cutAfter(root)).toBe(1);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowDown');

    expect(await cutAfter(root)).toBe(1);
    await expect(root.locator('.et-standings-pick-cut-label')).toHaveCount(1);
  });
});

test.describe('standings pick / cut line', () => {
  test('the cut sits between the last advancing row and the first below it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    const geometry = await root.evaluate((host) => {
      const rows = [...host.querySelectorAll('.et-standings-pick-row')].map((row) => row.getBoundingClientRect());
      const cut = host.querySelector('.et-standings-pick-cut')?.getBoundingClientRect();

      return { lastAdvancingBottom: rows[1]?.bottom ?? 0, firstBelowTop: rows[2]?.top ?? 0, cut: cut?.top ?? 0 };
    });

    expect(geometry.cut).toBeGreaterThanOrEqual(geometry.lastAdvancingBottom);
    expect(geometry.cut).toBeLessThan(geometry.firstBelowTop);
  });

  test('a list with no advancing places draws no cut', async ({ page }) => {
    const root = await openStory(page, NO_CUT_ID);

    expect(await cutAfter(root)).toBe(-1);
  });
});

test.describe('standings pick / locked', () => {
  test('a locked list offers no control and still reads the order', async ({ page }) => {
    const root = await openStory(page, LOCKED_ID);

    await expect(handles(root)).toHaveCount(0);
    await expect(names(root)).toHaveCount(4);
    await expect(root.locator('et-standings-pick')).toHaveAttribute('data-locked', '');
  });

  test('a locked list refuses an arrow key', async ({ page }) => {
    const root = await openStory(page, LOCKED_ID);
    const before = await names(root).allInnerTexts();

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await settle(page, 100);

    await expect(names(root)).toHaveText(before.map((name) => name.trim()));
  });
});
