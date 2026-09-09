import { Locator, Page, expect, test } from '@playwright/test';
import { expectFocusVisible, expectTouchMode, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-layout-masonry--default';
const APPENDING_STORY_ID = 'components-layout-masonry--appending-items';
const SINGLE_COLUMN_STORY_ID = 'components-layout-masonry--single-column';

const MASONRY = '.et-masonry';
const ITEM = '.et-masonry-item';

const DEFAULT_COLUMN_WIDTH = 240;
const DEFAULT_GAP = 16;

interface ItemGeometry {
  column: number;
  positioned: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MasonryGeometry {
  /** `clientWidth`, which is the number the directive resolves the columns from. */
  inlineSize: number;
  blockSize: number;
  items: ItemGeometry[];
}

/** The documented arithmetic: as many columns of `columnWidth` as fit with the gaps counted in. */
function expectedColumns(inlineSize: number, columnWidth: number, gap: number) {
  const count = Math.max(1, Math.floor((inlineSize + gap) / (columnWidth + gap)));

  return { count, inlineSize: (inlineSize - (count - 1) * gap) / count };
}

/** Greedy shortest-column packing over the measured heights, ties going to the column nearest the start. */
function packGreedily(heights: readonly number[], columnCount: number, gap: number) {
  const columnBlockSizes = Array.from({ length: columnCount }, () => 0);

  return heights.map((height) => {
    let column = 0;

    for (let candidate = 1; candidate < columnCount; candidate++) {
      if ((columnBlockSizes[candidate] ?? 0) < (columnBlockSizes[column] ?? 0)) column = candidate;
    }

    const blockOffset = columnBlockSizes[column] ?? 0;
    columnBlockSizes[column] = blockOffset + height + gap;

    return { column, blockOffset };
  });
}

/** Reads the rects once the items have finished moving - a rect read mid-transition is a frame, not a placement. */
function readGeometry(masonry: Locator): Promise<MasonryGeometry> {
  return masonry.evaluate(async (el) => {
    const settleAnimations = async () => {
      await Promise.all(
        el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)),
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };

    await settleAnimations();
    await settleAnimations();

    const host = el.getBoundingClientRect();

    return {
      inlineSize: el.clientWidth,
      blockSize: el.clientHeight,
      items: [...el.querySelectorAll('.et-masonry-item')].map((item) => {
        const rect = item.getBoundingClientRect();

        return {
          column: Number(item.getAttribute('data-column')),
          positioned: item.hasAttribute('data-positioned'),
          x: rect.x - host.x,
          y: rect.y - host.y,
          width: rect.width,
          height: rect.height,
        };
      }),
    };
  });
}

function itemAt(geometry: MasonryGeometry, index: number): ItemGeometry {
  const item = geometry.items[index];

  if (!item) throw new Error(`the masonry rendered no item at index ${index}`);

  return item;
}

/** A stable, comparable view of where the cards are, for the promises that say nothing may move. */
function placementKeys(geometry: MasonryGeometry): string[] {
  return geometry.items.map((item) => `${item.column}:${Math.round(item.x)}:${Math.round(item.y)}`);
}

async function waitForSettled(masonry: Locator): Promise<void> {
  await expect(masonry).toHaveAttribute('data-settled', '');
  await expect(masonry).not.toHaveAttribute('data-resizing', '');
}

/** Widens or narrows the window until the masonry's own content box is exactly `target` px. */
async function setMasonryInlineSize(page: Page, masonry: Locator, target: number): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('the page has no viewport to resize');

  let width = viewport.width;

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await masonry.evaluate((el) => el.clientWidth);

    if (current === target) break;

    width += target - current;
    await page.setViewportSize({ width, height: viewport.height });
    await page.waitForTimeout(100);
  }

  await waitForSettled(masonry);
  expect(await masonry.evaluate((el) => el.clientWidth)).toBe(target);
}

function focusedItemIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const item = (document.activeElement as HTMLElement | null)?.closest('.et-masonry-item');

    if (!item?.parentElement) return -1;

    return [...item.parentElement.children].indexOf(item);
  });
}

test.describe('masonry / layout', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: desktop container widths and window resizes');

  test('a 1000px container at columnWidth 240 and gap 16 gives three columns of 322.67px', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const masonry = root.locator(MASONRY);

    await setMasonryInlineSize(page, masonry, 1000);

    const geometry = await readGeometry(masonry);
    const columns = expectedColumns(1000, DEFAULT_COLUMN_WIDTH, DEFAULT_GAP);

    expect(columns.count).toBe(3);
    expect(new Set(geometry.items.map((item) => item.column)).size).toBe(3);

    for (const item of geometry.items) {
      expect(item.width).toBeCloseTo(322.67, 1);
      expect(item.x).toBeCloseTo(item.column * (columns.inlineSize + DEFAULT_GAP), 1);
    }
  });

  test('the column width is a minimum, never a division: the columns fill the container', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const masonry = root.locator(MASONRY);

    await waitForSettled(masonry);

    const geometry = await readGeometry(masonry);
    const columns = expectedColumns(geometry.inlineSize, DEFAULT_COLUMN_WIDTH, DEFAULT_GAP);
    const lastColumn = columns.count - 1;

    expect(columns.inlineSize).toBeGreaterThanOrEqual(DEFAULT_COLUMN_WIDTH);
    expect(new Set(geometry.items.map((item) => item.column)).size).toBe(columns.count);
    expect(lastColumn * (columns.inlineSize + DEFAULT_GAP) + columns.inlineSize).toBeCloseTo(geometry.inlineSize, 1);

    for (const item of geometry.items) {
      expect(item.width).toBeCloseTo(columns.inlineSize, 1);
    }
  });

  test('each card goes to the column that is shortest at its point in DOM order', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const masonry = root.locator(MASONRY);

    await waitForSettled(masonry);

    const geometry = await readGeometry(masonry);
    const columns = expectedColumns(geometry.inlineSize, DEFAULT_COLUMN_WIDTH, DEFAULT_GAP);
    const expected = packGreedily(
      geometry.items.map((item) => item.height),
      columns.count,
      DEFAULT_GAP,
    );

    expect(geometry.items.map((item) => item.column)).toEqual(expected.map((placement) => placement.column));

    for (const [index, item] of geometry.items.entries()) {
      expect(item.y).toBeCloseTo(expected[index]?.blockOffset ?? -1, 1);
    }
  });

  test('the container takes its height from the tallest column', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const masonry = root.locator(MASONRY);

    await waitForSettled(masonry);

    const geometry = await readGeometry(masonry);
    const tallestColumn = Math.max(...geometry.items.map((item) => item.y + item.height));

    expect(geometry.blockSize).toBeCloseTo(tallestColumn, 0);
  });

  test('a narrower window re-columns without a media query', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const masonry = root.locator(MASONRY);

    await setMasonryInlineSize(page, masonry, 1000);
    expect(new Set((await readGeometry(masonry)).items.map((item) => item.column)).size).toBe(3);

    await setMasonryInlineSize(page, masonry, 600);

    const geometry = await readGeometry(masonry);
    const columns = expectedColumns(600, DEFAULT_COLUMN_WIDTH, DEFAULT_GAP);

    expect(columns.count).toBe(2);
    expect(new Set(geometry.items.map((item) => item.column)).size).toBe(2);

    for (const item of geometry.items) {
      expect(item.width).toBeCloseTo(columns.inlineSize, 1);
      expect(item.x).toBeCloseTo(item.column * (columns.inlineSize + DEFAULT_GAP), 1);
    }
  });

  test('a resize that changes the column count packs from scratch, greedily', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const masonry = root.locator(MASONRY);

    await setMasonryInlineSize(page, masonry, 1000);
    await setMasonryInlineSize(page, masonry, 600);

    const geometry = await readGeometry(masonry);
    const expected = packGreedily(
      geometry.items.map((item) => item.height),
      2,
      DEFAULT_GAP,
    );

    expect(geometry.items.map((item) => item.column)).toEqual(expected.map((placement) => placement.column));
  });

  test('a column minimum wider than the container leaves one full-width column, stacked by the gap', async ({
    page,
  }) => {
    const root = await openStory(page, SINGLE_COLUMN_STORY_ID);
    const masonry = root.locator(MASONRY);

    await waitForSettled(masonry);

    const geometry = await readGeometry(masonry);

    expect(geometry.items.length).toBeGreaterThan(1);
    expect(new Set(geometry.items.map((item) => item.column))).toEqual(new Set([0]));

    for (const [index, item] of geometry.items.entries()) {
      const previous = geometry.items[index - 1];

      expect(item.x).toBeCloseTo(0, 1);
      expect(item.width).toBeCloseTo(geometry.inlineSize, 1);
      expect(item.y).toBeCloseTo(previous ? previous.y + previous.height + DEFAULT_GAP : 0, 1);
    }
  });

  test('appending a page leaves every card already on screen exactly where it was', async ({ page }) => {
    const root = await openStory(page, APPENDING_STORY_ID);
    const masonry = root.locator(MASONRY);
    const items = root.locator(ITEM);

    await waitForSettled(masonry);

    const before = await readGeometry(masonry);
    const placedCount = before.items.length;

    await root.getByRole('button', { name: 'Load more' }).click();
    await expect(items).toHaveCount(placedCount + 6);
    await waitForSettled(masonry);

    await expect
      .poll(async () => placementKeys(await readGeometry(masonry)).slice(0, placedCount))
      .toEqual(placementKeys(before));
  });

  test('a card growing pushes down only what is below it in its own column', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const masonry = root.locator(MASONRY);
    const items = root.locator(ITEM);

    await waitForSettled(masonry);

    const before = await readGeometry(masonry);
    const grown = itemAt(before, 0);

    await items.first().getByRole('button', { name: 'Show more' }).click();
    await expect.poll(async () => itemAt(await readGeometry(masonry), 0).height).toBeGreaterThan(grown.height);
    await waitForSettled(masonry);

    const delta = itemAt(await readGeometry(masonry), 0).height - grown.height;
    const expected = before.items.map((item, index) => {
      const isBelowInSameColumn = index > 0 && item.column === grown.column;

      return `${item.column}:${Math.round(item.x)}:${Math.round(isBelowInSameColumn ? item.y + delta : item.y)}`;
    });

    await expect.poll(async () => placementKeys(await readGeometry(masonry))).toEqual(expected);
  });
});

test.describe('masonry / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: tab order');

  test('Tab visits the cards in DOM order', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { itemCount: 6 } });

    await waitForSettled(root.locator(MASONRY));

    const visited: number[] = [];

    for (let i = 0; i < 6; i++) {
      await pressKey(page, 'Tab');
      visited.push(await focusedItemIndex(page));
    }

    expect(visited).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('the focus ring of a control inside a card is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { itemCount: 6 } });

    await waitForSettled(root.locator(MASONRY));
    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(ITEM).first().getByRole('button', { name: 'Show more' }));
  });

  test('the list semantics are explicit and no card is hidden from the reader', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { itemCount: 6 } });
    const masonry = root.locator(MASONRY);
    const items = root.locator(ITEM);

    await waitForSettled(masonry);

    await expect(masonry).toHaveAttribute('role', 'list');
    await expect(items.first()).toHaveAttribute('role', 'listitem');

    expect(await items.evaluateAll((els) => els.filter((el) => el.hasAttribute('inert')).length)).toBe(0);
    expect(await items.evaluateAll((els) => els.filter((el) => el.hasAttribute('aria-hidden')).length)).toBe(0);
    expect((await readGeometry(masonry)).items.every((item) => item.positioned)).toBe(true);
  });
});

test.describe('masonry / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: phone viewport and tap');

  test('a phone width collapses the masonry to one full-width column', async ({ page }) => {
    await expectTouchMode(page);

    const root = await openStory(page, DEFAULT_STORY_ID, { args: { itemCount: 8 } });
    const masonry = root.locator(MASONRY);

    await waitForSettled(masonry);

    const geometry = await readGeometry(masonry);

    expect(expectedColumns(geometry.inlineSize, DEFAULT_COLUMN_WIDTH, DEFAULT_GAP).count).toBe(1);
    expect(new Set(geometry.items.map((item) => item.column))).toEqual(new Set([0]));

    for (const [index, item] of geometry.items.entries()) {
      const previous = geometry.items[index - 1];

      expect(item.x).toBeCloseTo(0, 1);
      expect(item.width).toBeCloseTo(geometry.inlineSize, 1);
      expect(item.y).toBeCloseTo(previous ? previous.y + previous.height + DEFAULT_GAP : 0, 1);
    }
  });

  test('tapping a card grows it and pushes the card below it down', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { itemCount: 8 } });
    const masonry = root.locator(MASONRY);

    await waitForSettled(masonry);

    const before = await readGeometry(masonry);
    const next = itemAt(before, 1);

    await tap(root.locator(ITEM).first().getByRole('button', { name: 'Show more' }));

    await expect.poll(async () => itemAt(await readGeometry(masonry), 1).y).toBeGreaterThan(next.y);
  });
});
