import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap, touchDrag } from '../support';

const DEFAULT_STORY_ID = 'components-layout-grid--default';
const READONLY_STORY_ID = 'components-layout-grid--read-only';

const ITEM = '.et-grid-item';
const ITEM_CONTENT = '.et-grid-item__content';
const REMOVE_BUTTON = '.et-grid-item-default-actions__remove';

async function itemBox(item: Locator) {
  const box = await item.boundingBox();
  if (!box) throw new Error('grid item has no bounding box');
  return box;
}

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
    const before = await itemBox(item);

    await pressKey(page, 'Control+ArrowRight');
    await expect.poll(async () => (await itemBox(item)).x).toBeGreaterThan(before.x + 10);

    await pressKey(page, 'Control+ArrowLeft');
    await expect.poll(async () => (await itemBox(item)).x).toBeLessThan(before.x + 1);
  });

  test('Shift+ArrowRight and Shift+ArrowLeft resize the focused item across columns', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();

    await pressKey(page, 'Tab');
    const before = await itemBox(item);

    await pressKey(page, 'Shift+ArrowRight');
    await expect.poll(async () => (await itemBox(item)).width).toBeGreaterThan(before.width + 10);

    await pressKey(page, 'Shift+ArrowLeft');
    await expect.poll(async () => (await itemBox(item)).width).toBeLessThan(before.width + 1);
  });

  test('Shift+ArrowDown and Shift+ArrowUp resize the focused item across rows', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();

    await pressKey(page, 'Tab');
    const before = await itemBox(item);

    await pressKey(page, 'Shift+ArrowDown');
    await expect.poll(async () => (await itemBox(item)).height).toBeGreaterThan(before.height + 10);

    await pressKey(page, 'Shift+ArrowUp');
    await expect.poll(async () => (await itemBox(item)).height).toBeLessThan(before.height + 1);
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
    const before = await itemBox(item);

    await pressKey(page, 'Control+ArrowRight');
    await pressKey(page, 'Shift+ArrowRight');
    await page.waitForTimeout(200);

    const after = await itemBox(item);
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

    const before = await itemBox(item);
    const grabBox = await itemBox(content);
    const startX = grabBox.x + grabBox.width / 2;
    const startY = grabBox.y + grabBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 250, startY, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => (await itemBox(item)).x).toBeGreaterThan(before.x + 50);
  });

  test('a mouse drag on the resize handle changes the item size', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const item = root.locator(ITEM).first();
    const handle = item.locator('.et-resize-handle--se');

    const before = await itemBox(item);
    const handleBox = await itemBox(handle);
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => (await itemBox(item)).width).toBeGreaterThan(before.width + 10);
    await expect.poll(async () => (await itemBox(item)).height).toBeGreaterThan(before.height + 10);
  });

  test('the read-only story disables the resize handles and ignores a mouse drag', async ({ page }) => {
    const root = await openStory(page, READONLY_STORY_ID);
    const item = root.locator(ITEM).first();
    const content = item.locator(ITEM_CONTENT);

    await expect(item.locator('et-resize-handles')).toHaveAttribute('inert', '');

    const before = await itemBox(item);
    const grabBox = await itemBox(content);
    const startX = grabBox.x + grabBox.width / 2;
    const startY = grabBox.y + grabBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 150, startY + 100, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await itemBox(item);
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

    const before = await itemBox(item);
    const grabBox = await itemBox(content);
    const startX = grabBox.x + grabBox.width / 2;
    const startY = grabBox.y + grabBox.height / 2;

    await touchDrag(page, { x: startX, y: startY }, { x: startX, y: startY + 250 });

    await expect.poll(async () => (await itemBox(item)).y).toBeGreaterThan(before.y + 50);
  });

  test('a tap on the remove action removes the item', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const items = root.locator(ITEM);

    await expect(items).toHaveCount(4);

    await tap(items.first().locator(REMOVE_BUTTON));

    await expect(items).toHaveCount(3);
  });
});
