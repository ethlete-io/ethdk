import { CDPSession, Page, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey } from '../support';

const STORY_ID = 'components-forms-slider--default';
const THUMB = '.et-slider-thumb[role="slider"]';

async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> {
  const client: CDPSession = await page.context().newCDPSession(page);

  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });

  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;

    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }

  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('slider / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the thumb and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);

    await pressKey(page, 'Tab');

    await expectFocusVisible(thumb);
  });
});

test.describe('slider / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard and pointer value changes');

  test('ArrowRight and ArrowUp increase the value by one step', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);

    await pressKey(page, 'Tab');
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');

    await pressKey(page, 'ArrowRight');
    await expect(thumb).toHaveAttribute('aria-valuenow', '41');

    await pressKey(page, 'ArrowUp');
    await expect(thumb).toHaveAttribute('aria-valuenow', '42');
  });

  test('ArrowLeft and ArrowDown decrease the value by one step', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);

    await pressKey(page, 'Tab');
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');

    await pressKey(page, 'ArrowLeft');
    await expect(thumb).toHaveAttribute('aria-valuenow', '39');

    await pressKey(page, 'ArrowDown');
    await expect(thumb).toHaveAttribute('aria-valuenow', '38');
  });

  test('PageUp and PageDown move by ten steps', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);

    await pressKey(page, 'Tab');
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');

    await pressKey(page, 'PageUp');
    await expect(thumb).toHaveAttribute('aria-valuenow', '50');

    await pressKey(page, 'PageDown');
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
  });

  test('Home and End jump to the min and max, and aria-valuemin/max stay put', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);

    await pressKey(page, 'Tab');

    await pressKey(page, 'End');
    await expect(thumb).toHaveAttribute('aria-valuenow', '100');

    await pressKey(page, 'Home');
    await expect(thumb).toHaveAttribute('aria-valuenow', '0');

    await expect(thumb).toHaveAttribute('aria-valuemin', '0');
    await expect(thumb).toHaveAttribute('aria-valuemax', '100');
  });

  test('a pointer drag on the track changes the value', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);
    const track = root.locator('.et-slider-interaction');

    const box = await track.boundingBox();
    if (!box) throw new Error('slider track has no bounding box');

    await expect(thumb).toHaveAttribute('aria-valuenow', '40');

    const startX = box.x + box.width * 0.4;
    const endX = box.x + box.width * 0.9;
    const y = box.y + box.height / 2;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => Number(await thumb.getAttribute('aria-valuenow'))).toBeGreaterThan(40);
  });
});

test.describe('slider / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: touchscreen drag');

  test('a touchscreen drag changes the value and the thumb settles without sticking', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);
    const track = root.locator('.et-slider-interaction');

    const box = await track.boundingBox();
    if (!box) throw new Error('slider track has no bounding box');

    const startY = box.y + box.height / 2;
    const startX = box.x + box.width * 0.4;
    const endX = box.x + box.width * 0.85;

    await touchDrag(page, { x: startX, y: startY }, { x: endX, y: startY });

    await expect.poll(async () => Number(await thumb.getAttribute('aria-valuenow'))).toBeGreaterThan(40);

    await expect(thumb).not.toHaveAttribute('data-dragging');
  });
});
