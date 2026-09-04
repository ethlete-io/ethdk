import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, touchSwipe } from '../support';

const DEFAULT_STORY_ID = 'components-layout-scrollbar--default';
const HORIZONTAL_STORY_ID = 'components-layout-scrollbar--horizontal';
const AUTO_HIDE_STORY_ID = 'components-layout-scrollbar--auto-hide';
const BOTH_AXES_STORY_ID = 'components-layout-scrollbar--both-axes-and-rtl';

const VERTICAL_CONTAINER = '.overflow-y-auto';
const HORIZONTAL_CONTAINER = '.overflow-x-auto';
const SCROLLBAR = '.et-scrollbar';
const THUMB = '.et-scrollbar-thumb';

async function thumbOffset(scrollbar: Locator): Promise<number> {
  const value = await scrollbar
    .locator(THUMB)
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--_et-scrollbar-thumb-offset'));
  return parseFloat(value);
}

test.describe('scrollbar / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the vertical scroll container and its focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);

    await page.keyboard.press('Tab');

    await expectFocusVisible(container);
  });

  test('Tab reaches the horizontal scroll container and its focus ring is visible', async ({ page }) => {
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const container = root.locator(HORIZONTAL_CONTAINER);

    await page.keyboard.press('Tab');

    await expectFocusVisible(container);
  });
});

test.describe('scrollbar / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: the scroll container owns keyboard scrolling');

  test('ArrowDown scrolls the focused container down', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);

    await page.keyboard.press('Tab');
    await expect(container).toBeFocused();

    await page.keyboard.press('ArrowDown');

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('PageDown pages down and Home returns to the top', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);

    await page.keyboard.press('Tab');
    await page.keyboard.press('PageDown');

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.keyboard.press('Home');

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('End jumps to the bottom of the container', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const maxScroll = await container.evaluate((el) => el.scrollHeight - el.clientHeight);

    await page.keyboard.press('Tab');
    await page.keyboard.press('End');

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBe(maxScroll);
  });
});

test.describe('scrollbar / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse-driven scrollbar interactions');

  test('scrolling the container moves the custom thumb', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const scrollbar = root.locator(SCROLLBAR).first();

    expect(await thumbOffset(scrollbar)).toBe(0);

    await container.hover();
    await page.mouse.wheel(0, 100);

    await expect.poll(() => thumbOffset(scrollbar)).toBeGreaterThan(0);
  });

  test('dragging the thumb scrolls the content', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const thumb = root.locator(THUMB);

    const box = await thumb.boundingBox();
    if (!box) throw new Error('thumb has no bounding box');

    const x = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, startY + 100, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('a click on the track, away from the thumb, pages the container one viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const scrollbar = root.locator(SCROLLBAR).first();

    const box = await scrollbar.boundingBox();
    if (!box) throw new Error('scrollbar has no bounding box');
    const viewportSize = await container.evaluate((el) => el.clientHeight);

    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 5);

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBe(viewportSize);
  });

  test('the horizontal story mirrors scrollLeft into the thumb offset', async ({ page }) => {
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const container = root.locator(HORIZONTAL_CONTAINER);
    const scrollbar = root.locator(SCROLLBAR).first();

    await expect(scrollbar).toHaveAttribute('data-orientation', 'horizontal');

    await container.evaluate((el) => {
      el.scrollLeft = 100;
    });

    await expect.poll(() => thumbOffset(scrollbar)).toBeGreaterThan(0);
  });

  test('the both-axes story mirrors each axis with its own scrollbar', async ({ page }) => {
    const root = await openStory(page, BOTH_AXES_STORY_ID);
    const bothSection = root.locator('section', { hasText: 'Both axes' });
    const container = bothSection.locator('.overflow-auto');
    const vertical = bothSection.locator(`${SCROLLBAR}[data-orientation="vertical"]`);
    const horizontal = bothSection.locator(`${SCROLLBAR}[data-orientation="horizontal"]`);

    await container.evaluate((el) => {
      el.scrollTop = 60;
    });
    await expect.poll(() => thumbOffset(vertical)).toBeGreaterThan(0);
    expect(await thumbOffset(horizontal)).toBe(0);

    await container.evaluate((el) => {
      el.scrollLeft = 60;
    });
    await expect.poll(() => thumbOffset(horizontal)).toBeGreaterThan(0);
  });

  test('in a right-to-left container the scrollbar reports the direction and a leftward drag scrolls towards the end', async ({
    page,
  }) => {
    const root = await openStory(page, BOTH_AXES_STORY_ID);
    const rtlSection = root.locator('section', { hasText: 'Right to left' });
    const track = rtlSection.locator(HORIZONTAL_CONTAINER);
    const scrollbar = rtlSection.locator(SCROLLBAR);
    const thumb = rtlSection.locator(THUMB);

    await expect(scrollbar).toHaveAttribute('data-direction', 'rtl');
    expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);

    const box = await thumb.boundingBox();
    if (!box) throw new Error('thumb has no bounding box');

    const y = box.y + box.height / 2;
    const startX = box.x + box.width / 2;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 80, y, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThan(0);
  });

  test('the auto-hide story hides the thumb until a scroll, then hides it again after inactivity', async ({ page }) => {
    const root = await openStory(page, AUTO_HIDE_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const scrollbar = root.locator(SCROLLBAR).first();

    await expect(scrollbar).not.toHaveClass(/et-scrollbar--visible/);

    await container.hover();
    await page.mouse.wheel(0, 50);

    await expect(scrollbar).toHaveClass(/et-scrollbar--visible/);

    await page.mouse.move(0, 0);
    await expect(scrollbar).not.toHaveClass(/et-scrollbar--visible/, { timeout: 2000 });
  });

  test('the auto-hide story keeps the thumb visible while the pointer is over the target', async ({ page }) => {
    const root = await openStory(page, AUTO_HIDE_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const scrollbar = root.locator(SCROLLBAR).first();

    await container.hover();

    await expect(scrollbar).toHaveClass(/et-scrollbar--visible/);
    await page.waitForTimeout(900);
    await expect(scrollbar).toHaveClass(/et-scrollbar--visible/);
  });
});

test.describe('scrollbar / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: swipe gestures');

  test('a touch swipe scrolls the container natively and the thumb follows', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const scrollbar = root.locator(SCROLLBAR).first();

    const box = await container.boundingBox();
    if (!box) throw new Error('container has no bounding box');

    const x = box.x + box.width / 2;
    const startY = box.y + box.height * 0.8;
    const endY = box.y + box.height * 0.2;

    expect(await thumbOffset(scrollbar)).toBe(0);

    await touchSwipe(page, { x, y: startY }, { x, y: endY });

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => thumbOffset(scrollbar)).toBeGreaterThan(0);
  });

  test('a touch drag directly on the thumb also scrolls the container', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(VERTICAL_CONTAINER);
    const thumb = root.locator(THUMB);

    const box = await thumb.boundingBox();
    if (!box) throw new Error('thumb has no bounding box');

    const x = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await touchSwipe(page, { x, y: startY }, { x, y: startY + 100 });

    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
});
