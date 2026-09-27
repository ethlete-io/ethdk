import { Locator, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, touchDrag } from '../support';

const STORY_ID = 'components-forms-slider--default';
const THUMB = '.et-slider-thumb[role="slider"]';

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

    const box = await boxOf(track);

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

    const box = await boxOf(track);

    const startY = box.y + box.height / 2;
    const startX = box.x + box.width * 0.4;
    const endX = box.x + box.width * 0.85;

    await touchDrag(page, { x: startX, y: startY }, { x: endX, y: startY });

    await expect.poll(async () => Number(await thumb.getAttribute('aria-valuenow'))).toBeGreaterThan(40);

    await expect(thumb).not.toHaveAttribute('data-dragging');
  });
});

const RTL_STORY_ID = 'components-forms-slider--right-to-left';
const VERTICAL_STORY_ID = 'components-forms-slider--vertical';
const VALUE_LABEL_STORY_ID = 'components-forms-slider--value-label';

const valueOf = async (thumb: Locator) => Number(await thumb.getAttribute('aria-valuenow'));

const centerOf = async (locator: Locator) => {
  const box = await boxOf(locator);

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function expectNoThumbRing(thumb: Locator) {
  await expect(thumb).toBeFocused();
  await expect(thumb).toHaveCSS('outline-style', 'none');
}

test.describe('slider / pointer drag', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag and focus ring');

  test('the drag keeps the pointer after it leaves the track, and past the end it pins the max', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);
    const box = await boxOf(root.locator('.et-slider-interaction'));
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width * 0.4, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, y + 200, { steps: 8 });

    await expect(thumb).toHaveAttribute('data-dragging');
    await expect.poll(() => valueOf(thumb)).toBeGreaterThanOrEqual(65);

    await page.mouse.move(box.x + box.width + 300, y + 200, { steps: 8 });
    await page.mouse.up();

    await expect(thumb).toHaveAttribute('aria-valuenow', '100');
    await expect(thumb).not.toHaveAttribute('data-dragging');
  });

  test('a press focuses the thumb without a ring, and the next key brings the ring back', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);
    const box = await boxOf(root.locator('.et-slider-interaction'));

    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);

    await expect(thumb).toHaveAttribute('data-pointer-focused');
    await expectNoThumbRing(thumb);

    await pressKey(page, 'ArrowRight');

    await expect(thumb).not.toHaveAttribute('data-pointer-focused');
    await expectFocusVisible(thumb);
  });

  test('in RTL the track is mirrored: the thumb sits from the right and a leftward drag increases', async ({
    page,
  }) => {
    const root = await openStory(page, RTL_STORY_ID);
    const thumb = root.locator(THUMB);
    const box = await boxOf(root.locator('.et-slider-interaction'));
    const thumbCenter = await centerOf(thumb);

    expect(thumbCenter.x - box.x).toBeCloseTo(box.width * 0.6, -1);

    await page.mouse.move(thumbCenter.x, thumbCenter.y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, thumbCenter.y, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => valueOf(thumb)).toBeGreaterThanOrEqual(75);
  });

  test('in RTL ArrowLeft increases and ArrowRight decreases, following the visual direction', async ({ page }) => {
    const root = await openStory(page, RTL_STORY_ID);
    const thumb = root.locator(THUMB);

    await pressKey(page, 'Tab');
    await expect(thumb).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(thumb).toHaveAttribute('aria-valuenow', '41');

    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');
    await expect(thumb).toHaveAttribute('aria-valuenow', '39');
  });

  test('a vertical slider runs bottom to top: the thumb sits from the bottom and an upward drag increases', async ({
    page,
  }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const thumb = root.locator(THUMB);
    const box = await boxOf(root.locator('.et-slider-interaction'));
    const thumbCenter = await centerOf(thumb);

    await expect(thumb).toHaveAttribute('aria-orientation', 'vertical');
    expect(box.y + box.height - thumbCenter.y).toBeCloseTo(box.height * 0.4, -1);

    await page.mouse.move(thumbCenter.x, thumbCenter.y);
    await page.mouse.down();
    await page.mouse.move(thumbCenter.x, box.y + box.height * 0.1, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => valueOf(thumb)).toBeGreaterThanOrEqual(85);
  });

  test('the value label sits centred above a horizontal thumb and follows it', async ({ page }) => {
    const root = await openStory(page, VALUE_LABEL_STORY_ID);
    const thumb = root.locator(THUMB);
    const bubble = thumb.locator('.et-slider-thumb-value');

    await expect(bubble).toHaveText('40');

    const before = await boxOf(bubble);
    const thumbBox = await boxOf(thumb);

    expect(before.y + before.height).toBeLessThanOrEqual(thumbBox.y);
    expect(before.x + before.width / 2).toBeCloseTo(thumbBox.x + thumbBox.width / 2, 0);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');

    await expect(bubble).toHaveText('100');
    await expect.poll(async () => (await boxOf(bubble)).x).toBeGreaterThan(before.x + 50);
  });

  test('the value label of a vertical slider sits beside the thumb, on its inline-end side', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const thumb = root.locator(THUMB);
    const bubble = thumb.locator('.et-slider-thumb-value');
    const bubbleBox = await boxOf(bubble);
    const thumbBox = await boxOf(thumb);

    expect(bubbleBox.x).toBeGreaterThanOrEqual(thumbBox.x + thumbBox.width);
    expect(bubbleBox.y + bubbleBox.height / 2).toBeCloseTo(thumbBox.y + thumbBox.height / 2, 0);
  });
});

test.describe('slider / touch pan', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: native panning on the other axis');

  test('a horizontal slider leaves vertical panning to the browser', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.locator('.et-slider-interaction')).toHaveCSS('touch-action', 'pan-y');
    await expect(root.locator(THUMB)).toHaveCSS('touch-action', 'pan-y');
  });

  test('a vertical swipe on the thumb scrolls the page and leaves the value alone', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const thumb = root.locator(THUMB);

    await page.evaluate(() => (document.body.style.minHeight = '3000px'));

    const start = await centerOf(thumb);

    await touchDrag(page, start, { x: start.x, y: start.y - 250 }, { steps: 10 });

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
    await expect(thumb).not.toHaveAttribute('data-dragging');
  });

  test('a vertical slider leaves horizontal panning to the browser and follows a vertical drag', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const thumb = root.locator(THUMB);
    const box = await boxOf(root.locator('.et-slider-interaction'));

    await expect(root.locator('.et-slider-interaction')).toHaveCSS('touch-action', 'pan-x');

    const start = await centerOf(thumb);

    await touchDrag(page, start, { x: start.x, y: box.y + box.height * 0.1 });

    await expect.poll(() => valueOf(thumb)).toBeGreaterThanOrEqual(85);
    await expect(thumb).not.toHaveAttribute('data-dragging');
  });
});
