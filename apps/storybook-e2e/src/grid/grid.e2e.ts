import { Locator, Page, expect, test } from '@playwright/test';
import { TouchPoint, boxOf, expectFocusVisible, openStory, pressKey, settle, tap, touchDrag } from '../support';

const DEFAULT_STORY_ID = 'components-layout-grid--default';
const READONLY_STORY_ID = 'components-layout-grid--read-only';
const SCROLLABLE_CONTAINER_STORY_ID = 'components-layout-grid--scrollable-container';
/** The story's default `rowHeight` plus `gap`. */
const ROW_PITCH = 116;

const ITEM = '.et-grid-item';
const ITEM_CONTENT = '.et-grid-item__content';
const REMOVE_BUTTON = '.et-grid-item-default-actions__remove';

test.describe('grid / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the first grid item and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(item);
  });

  test('Tab cycles from an item to its remove action, then to the next item', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const items = root.locator(ITEM);

    await pressKey(page, 'Tab');
    await expect(items.nth(0)).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(root.locator(REMOVE_BUTTON).nth(0)).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(items.nth(1)).toBeFocused();
  });
});

test.describe('grid / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard move/resize/remove shortcuts');

  test('Control+ArrowRight and Control+ArrowLeft move the focused item across columns', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();

    await pressKey(page, 'Tab');
    const before = await boxOf(item);

    await pressKey(page, 'Control+ArrowRight');
    await expect.poll(async () => (await boxOf(item)).x).toBeGreaterThan(before.x + 10);

    await pressKey(page, 'Control+ArrowLeft');
    await expect.poll(async () => (await boxOf(item)).x).toBeLessThan(before.x + 1);
  });

  test('Shift+ArrowRight and Shift+ArrowLeft resize the focused item across columns', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();

    await pressKey(page, 'Tab');
    const before = await boxOf(item);

    await pressKey(page, 'Shift+ArrowRight');
    await expect.poll(async () => (await boxOf(item)).width).toBeGreaterThan(before.width + 10);

    await pressKey(page, 'Shift+ArrowLeft');
    await expect.poll(async () => (await boxOf(item)).width).toBeLessThan(before.width + 1);
  });

  test('Shift+ArrowDown and Shift+ArrowUp resize the focused item across rows', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();

    await pressKey(page, 'Tab');
    const before = await boxOf(item);

    await pressKey(page, 'Shift+ArrowDown');
    await expect.poll(async () => (await boxOf(item)).height).toBeGreaterThan(before.height + 10);

    await pressKey(page, 'Shift+ArrowUp');
    await expect.poll(async () => (await boxOf(item)).height).toBeLessThan(before.height + 1);
  });

  test('Control+Delete removes the focused item', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const items = root.locator(ITEM);

    await expect(items).toHaveCount(4);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Control+Delete');

    await expect(items).toHaveCount(3);
  });

  test('a read-only grid ignores the Control+Arrow and Shift+Arrow shortcuts', async ({ page }) => {
    const root = await openStory(page, READONLY_STORY_ID);
    const item = root.locator(ITEM).first();

    await pressKey(page, 'Tab');
    const before = await boxOf(item);

    await pressKey(page, 'Control+ArrowRight');
    await pressKey(page, 'Shift+ArrowRight');
    await settle(page, 200);

    const after = await boxOf(item);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.width).toBeCloseTo(before.width, 0);
  });
});

test.describe('grid / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag and resize gestures');

  test('a mouse drag on an item moves it to a new cell', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).nth(2);
    const content = item.locator(ITEM_CONTENT);

    const before = await boxOf(item);
    const grabBox = await boxOf(content);
    const startX = grabBox.x + grabBox.width / 2;
    const startY = grabBox.y + grabBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 250, startY, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => (await boxOf(item)).x).toBeGreaterThan(before.x + 50);
  });

  test('a mouse drag on the resize handle changes the item size', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();
    const handle = item.locator('.et-resize-handle--se');

    const before = await boxOf(item);
    const handleBox = await boxOf(handle);
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => (await boxOf(item)).width).toBeGreaterThan(before.width + 10);
    await expect.poll(async () => (await boxOf(item)).height).toBeGreaterThan(before.height + 10);
  });

  test('the read-only story disables the resize handles and ignores a mouse drag', async ({ page }) => {
    const root = await openStory(page, READONLY_STORY_ID);
    const item = root.locator(ITEM).first();
    const content = item.locator(ITEM_CONTENT);

    await expect(item.locator('et-resize-handles')).toHaveAttribute('inert', '');

    const before = await boxOf(item);
    const grabBox = await boxOf(content);
    const startX = grabBox.x + grabBox.width / 2;
    const startY = grabBox.y + grabBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 150, startY + 100, { steps: 10 });
    await page.mouse.up();
    await settle(page, 200);

    const after = await boxOf(item);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });
});

test.describe('grid / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: touchscreen drag and tap');

  test('a touch drag moves an item past its neighbor', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();
    const content = item.locator(ITEM_CONTENT);

    const before = await boxOf(item);
    const grabBox = await boxOf(content);
    const startX = grabBox.x + grabBox.width / 2;
    const startY = grabBox.y + grabBox.height / 2;

    await touchDrag(page, { x: startX, y: startY }, { x: startX, y: startY + 250 });

    await expect.poll(async () => (await boxOf(item)).y).toBeGreaterThan(before.y + 50);
  });

  test('a tap on the remove action removes the item', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const items = root.locator(ITEM);

    await expect(items).toHaveCount(4);

    await tap(items.first().locator(REMOVE_BUTTON));

    await expect(items).toHaveCount(3);
  });
});

const GRID = '.et-grid';

async function inlineTransition(locator: Locator): Promise<string> {
  return locator.evaluate((element: HTMLElement) => element.style.transition);
}

function waitForItemTransition(page: Page, value: string) {
  return page.waitForFunction(
    (expected) => document.querySelector<HTMLElement>('.et-grid-item')?.style.transition === expected,
    value,
    { polling: 'raf' },
  );
}

async function expectSameRow(a: Locator, b: Locator): Promise<void> {
  expect((await boxOf(a)).y).toBeCloseTo((await boxOf(b)).y, 0);
}

async function expectStackedFullWidth(grid: Locator, items: Locator[]): Promise<void> {
  const gridBox = await boxOf(grid);
  const boxes = await Promise.all(items.map((item) => boxOf(item)));

  for (const [index, box] of boxes.entries()) {
    expect(box.width).toBeCloseTo(gridBox.width, 0);
    expect(box.y).toBeGreaterThan(boxes[index - 1]?.y ?? gridBox.y - 1);
  }
}

test.describe('grid / motion', () => {
  test('items and the container animate their geometry once the grid has settled', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect.poll(() => inlineTransition(root.locator(ITEM).first())).toContain('translate');
    expect(await inlineTransition(root.locator(ITEM).first())).toContain('width');
    expect(await inlineTransition(root.locator(GRID))).toContain('height');
  });

  test('reduced motion turns every item and container transition off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const root = await openStory(page, DEFAULT_STORY_ID);
    await settle(page, 200);

    const transitions = await root
      .locator(ITEM)
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).style.transition));

    expect(transitions).toEqual(['none', 'none', 'none', 'none']);
    expect(await inlineTransition(root.locator(GRID))).toBe('none');
  });
});

test.describe('grid / pointer motion', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('the dragged item follows the pointer untransitioned while its neighbours keep animating', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dragged = root.locator(ITEM).nth(2);
    const neighbour = root.locator(ITEM).nth(3);
    const grab = await boxOf(dragged.locator(ITEM_CONTENT));
    const x = grab.x + grab.width / 2;
    const y = grab.y + grab.height / 2;

    await expect.poll(() => inlineTransition(dragged)).toContain('translate');

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 150, y, { steps: 10 });

    await expect(dragged).toHaveClass(/et-grid-item--dragging/);
    expect(await inlineTransition(dragged)).toBe('none');
    expect(await inlineTransition(neighbour)).toContain('translate');

    await page.mouse.up();

    await expect.poll(() => inlineTransition(dragged)).toContain('translate');
  });

  test('dragging an item to the bottom edge of the viewport scrolls the page', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 600 });

    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();
    const grab = await boxOf(item.locator(ITEM_CONTENT));
    const x = grab.x + grab.width / 2;

    await page.mouse.move(x, grab.y + 20);
    await page.mouse.down();
    await page.mouse.move(x, 590, { steps: 10 });

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);

    await page.mouse.up();

    await expect(item).not.toHaveClass(/et-grid-item--dragging/);
  });
});

test.describe('grid / container resize', () => {
  test.skip(({ isMobile }) => isMobile, 'resizes a desktop viewport across the lg, md and sm breakpoints');

  test('crossing a breakpoint reflows the items to its columns without animating the jump', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const grid = root.locator(GRID);
    const items = [0, 1, 2, 3].map((index) => root.locator(ITEM).nth(index));
    const first = root.locator(ITEM).nth(0);

    await expectSameRow(first, root.locator(ITEM).nth(1));
    await expect.poll(() => inlineTransition(first)).toContain('translate');

    const suppressed = waitForItemTransition(page, 'none');
    await page.setViewportSize({ width: 900, height: 720 });
    await suppressed;

    await expect.poll(async () => (await boxOf(first)).width).toBeCloseTo((await boxOf(grid)).width, 0);
    await expectStackedFullWidth(grid, items);
    await expect.poll(() => inlineTransition(first)).toContain('translate');

    await page.setViewportSize({ width: 500, height: 720 });

    await expect.poll(async () => (await boxOf(grid)).width).toBeLessThan(500);
    await expect.poll(async () => (await boxOf(first)).width).toBeCloseTo((await boxOf(grid)).width, 0);
    await expectStackedFullWidth(grid, items);
  });
});

interface HeldDrag {
  moveTo: (to: TouchPoint) => Promise<void>;
  release: () => Promise<void>;
}

async function holdMouse(page: Page, from: TouchPoint): Promise<HeldDrag> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();

  return {
    moveTo: (to) => page.mouse.move(to.x, to.y, { steps: 10 }),
    release: () => page.mouse.up(),
  };
}

async function holdFinger(page: Page, from: TouchPoint): Promise<HeldDrag> {
  const cdp = await page.context().newCDPSession(page);
  let at = from;

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });

  return {
    moveTo: async (to) => {
      for (let step = 1; step <= 10; step++) {
        const point = { x: at.x + ((to.x - at.x) * step) / 10, y: at.y + ((to.y - at.y) * step) / 10 };

        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
      }

      at = to;
    },
    release: async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

const offsetInGrid = (locator: Locator) =>
  locator.evaluate((el) => {
    const grid = el.closest('.et-grid')?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();

    return { x: Math.round(rect.left - (grid?.left ?? 0)), y: Math.round(rect.top - (grid?.top ?? 0)) };
  });

const scrollStateOf = (container: Locator) =>
  container.evaluate((el) => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight }));

async function expectAutoScrollDropsIntoTheGhostSlot(
  page: Page,
  hold: (page: Page, from: TouchPoint) => Promise<HeldDrag>,
): Promise<void> {
  const root = await openStory(page, SCROLLABLE_CONTAINER_STORY_ID);
  const container = root.getByTestId('grid-scroll-container');
  const item = root.locator(ITEM).first();
  const ghost = root.locator('.et-grid-ghost');

  await expect.poll(() => inlineTransition(item)).toContain('translate');

  const visibleHeight = await container.evaluate((el) => el.clientHeight);
  const edge = await boxOf(container);
  const grab = await boxOf(item.locator(ITEM_CONTENT));
  const x = grab.x + grab.width / 2;

  const drag = await hold(page, { x, y: grab.y + 20 });
  await drag.moveTo({ x, y: edge.y + edge.height - 8 });

  await expect(item).toHaveClass(/et-grid-item--dragging/);
  await expect.poll(async () => (await scrollStateOf(container)).top).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const state = await scrollStateOf(container);
      return state.max - state.top;
    })
    .toBe(0);

  const slot = await offsetInGrid(ghost);
  expect(slot.y).toBeGreaterThan(visibleHeight);
  expect(slot.y % ROW_PITCH).toBe(0);

  await drag.release();

  await expect(item).not.toHaveClass(/et-grid-item--dragging/);
  await expect(ghost).toHaveCount(0);
  await expect.poll(() => offsetInGrid(item)).toEqual(slot);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
}

test.describe('grid / auto-scroll', () => {
  test('a mouse drag at the bottom edge of a scroll container scrolls it and drops into the projected slot', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'pointer-only: mouse drag');

    await expectAutoScrollDropsIntoTheGhostSlot(page, holdMouse);
  });

  test('a touch drag at the bottom edge of a scroll container scrolls it and drops into the projected slot', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'touch-only: touchscreen drag');

    await expectAutoScrollDropsIntoTheGhostSlot(page, holdFinger);
  });
});
