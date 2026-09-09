import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, expectTouchMode, openStory, pressKey, touchSwipe } from '../support';

const DEFAULT_STORY_ID = 'components-layout-scrollable--default';
const VERTICAL_STORY_ID = 'components-layout-scrollable--vertical';
const NAVIGATION_STORY_ID = 'components-layout-scrollable--with-navigation';
const SNAP_STORY_ID = 'components-layout-scrollable--with-snap';
const FOOTER_BUTTONS_STORY_ID = 'components-layout-scrollable--footer-buttons';

const HOST = '.et-scrollable';
const CONTAINER = '.et-scrollable-container';
const FOOTER = '.et-scrollable-footer';
const ITEM = '.et-sb-scrollable-item';
const PREVIOUS_BUTTON = '.et-scrollable-button--start';
const NEXT_BUTTON = '.et-scrollable-button--end';
const DOT = '.et-scrollable-navigation-item';
const SENTINEL = '.et-scroll-observer-first-element';

/** The story renders two toolbar buttons above the track, so the third Tab lands on its first child. */
const TABS_TO_FIRST_CHILD = 3;

function readScrollLeft(container: Locator): Promise<number> {
  return container.evaluate((el) => el.scrollLeft);
}

function readScrollTop(container: Locator): Promise<number> {
  return container.evaluate((el) => el.scrollTop);
}

function readItemOffsets(root: Locator): Promise<number[]> {
  return root.locator(ITEM).evaluateAll((els) => els.map((el) => (el as HTMLElement).offsetLeft));
}

/** Polls until two consecutive reads of `scrollLeft` agree, then yields that offset. */
async function settledScrollLeft(container: Locator): Promise<number> {
  let previous = Number.NaN;

  await expect
    .poll(
      async () => {
        const current = await readScrollLeft(container);
        const settled = current === previous;
        previous = current;

        return settled;
      },
      { timeout: 8000, intervals: [150] },
    )
    .toBe(true);

  return previous;
}

test.describe('scrollable / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the scrolled children and their focus ring is visible', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);

    for (let i = 0; i < TABS_TO_FIRST_CHILD; i++) {
      await pressKey(page, 'Tab');
    }

    await expectFocusVisible(root.locator(ITEM).first());
  });

  test('the previous and next buttons are aria-hidden', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);

    await expect(root.locator(PREVIOUS_BUTTON)).toHaveAttribute('aria-hidden', 'true');
    await expect(root.locator(NEXT_BUTTON)).toHaveAttribute('aria-hidden', 'true');
  });

  test('the previous and next buttons are removed from the tab order', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);

    expect(await root.locator(PREVIOUS_BUTTON).evaluate((el) => (el as HTMLElement).tabIndex)).toBe(-1);
    expect(await root.locator(NEXT_BUTTON).evaluate((el) => (el as HTMLElement).tabIndex)).toBe(-1);
  });

  test('the navigation dots are aria-hidden and removed from the tab order', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);
    const dots = root.locator(DOT);

    await expect(dots.first()).toHaveAttribute('aria-hidden', 'true');
    expect(await dots.evaluateAll((els) => els.map((el) => (el as HTMLElement).tabIndex))).not.toContain(0);
  });
});

test.describe('scrollable / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: the scroll container owns keyboard scrolling');

  test('ArrowRight scrolls a horizontal track with a focused child, ArrowLeft scrolls back', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(CONTAINER);

    for (let i = 0; i < TABS_TO_FIRST_CHILD; i++) {
      await pressKey(page, 'Tab');
    }
    await expect(root.locator(ITEM).first()).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => readScrollLeft(container)).toBeGreaterThan(0);

    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => readScrollLeft(container)).toBe(0);
  });

  test('ArrowDown scrolls a vertical track with a focused child', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const container = root.locator(CONTAINER);

    for (let i = 0; i < TABS_TO_FIRST_CHILD; i++) {
      await pressKey(page, 'Tab');
    }
    expect(await readScrollTop(container)).toBe(0);

    await page.keyboard.press('ArrowDown');

    await expect.poll(() => readScrollTop(container)).toBeGreaterThan(0);
  });

  test('tabbing on to a child beyond the viewport scrolls the track to it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(CONTAINER);
    const items = root.locator(ITEM);
    const lastIndex = (await items.count()) - 1;

    for (let i = 0; i < TABS_TO_FIRST_CHILD + lastIndex; i++) {
      await pressKey(page, 'Tab');
    }

    await expect(items.nth(lastIndex)).toBeFocused();
    await expect.poll(() => readScrollLeft(container)).toBeGreaterThan(0);
  });
});

test.describe('scrollable / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse-driven navigation and cursor drag');

  test('the next button scrolls the track forwards', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);
    const container = root.locator(CONTAINER);

    expect(await readScrollLeft(container)).toBe(0);

    await root.locator(NEXT_BUTTON).click();

    await expect.poll(() => readScrollLeft(container)).toBeGreaterThan(0);
  });

  test('the buttons disable at the start and at the end of the track', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);
    const container = root.locator(CONTAINER);

    await expect(root.locator(PREVIOUS_BUTTON)).toBeDisabled();
    await expect(root.locator(NEXT_BUTTON)).toBeEnabled();

    await container.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });

    await expect(root.locator(PREVIOUS_BUTTON)).toBeEnabled();
    await expect(root.locator(NEXT_BUTTON)).toBeDisabled();
  });

  test('the footer position puts the buttons in the footer row and they still scroll the track', async ({ page }) => {
    const root = await openStory(page, FOOTER_BUTTONS_STORY_ID);
    const container = root.locator(CONTAINER);

    await expect(root.locator(`${FOOTER} ${PREVIOUS_BUTTON}`)).toBeVisible();
    await expect(root.locator(`${FOOTER} ${NEXT_BUTTON}`)).toBeVisible();

    await root.locator(`${FOOTER} ${NEXT_BUTTON}`).click();

    await expect.poll(() => readScrollLeft(container)).toBeGreaterThan(0);
  });

  test('snapping resolves to a proximity snap on the scroll axis, with the sentinels excluded', async ({ page }) => {
    const root = await openStory(page, SNAP_STORY_ID);
    const host = root.locator(HOST);
    const container = root.locator(CONTAINER);

    await expect(host).toHaveAttribute('snap', '');
    await expect(host).toHaveAttribute('snap-origin', 'auto');

    const snapType = await container.evaluate((el) => getComputedStyle(el).scrollSnapType);
    expect(snapType.startsWith('x')).toBe(true);
    expect(snapType).not.toContain('mandatory');

    expect(
      await root
        .locator(ITEM)
        .first()
        .evaluate((el) => getComputedStyle(el).scrollSnapAlign),
    ).toBe('start');
    expect(await root.locator(SENTINEL).evaluate((el) => getComputedStyle(el).scrollSnapAlign)).toBe('none');
  });

  test('with scrollMode "element" the next button lands exactly on the next child', async ({ page }) => {
    const root = await openStory(page, SNAP_STORY_ID);
    const container = root.locator(CONTAINER);
    const offsets = await readItemOffsets(root);

    await root.locator(NEXT_BUTTON).click();

    expect(await settledScrollLeft(container)).toBe(offsets[1]);
  });

  test('a cursor drag holds snapping off while it runs and settles on a child on release', async ({ page }) => {
    const root = await openStory(page, SNAP_STORY_ID);
    const host = root.locator(HOST);
    const container = root.locator(CONTAINER);
    const offsets = await readItemOffsets(root);

    const box = await container.boundingBox();
    if (!box) throw new Error('scroll container has no bounding box');

    const y = box.y + box.height / 2;
    const startX = box.x + box.width * 0.7;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 120, y, { steps: 12 });

    await expect(host).toHaveAttribute('snap-suspended', '');

    await page.mouse.up();

    expect(offsets).toContain(await settledScrollLeft(container));
    await expect(host).not.toHaveAttribute('snap-suspended', '');
  });
});

test.describe('scrollable / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: swipe gestures');

  test('a swipe scrolls the track', async ({ page }) => {
    await expectTouchMode(page);

    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(CONTAINER);

    const box = await container.boundingBox();
    if (!box) throw new Error('scroll container has no bounding box');

    const y = box.y + box.height / 2;
    const before = await readScrollLeft(container);

    await touchSwipe(page, { x: box.x + box.width * 0.85, y }, { x: box.x + box.width * 0.15, y });

    await expect.poll(() => readScrollLeft(container)).toBeGreaterThan(before);
  });

  test('a swipe on a snapping track comes to rest on a child', async ({ page }) => {
    const root = await openStory(page, SNAP_STORY_ID);
    const container = root.locator(CONTAINER);
    const offsets = await readItemOffsets(root);

    const box = await container.boundingBox();
    if (!box) throw new Error('scroll container has no bounding box');

    const y = box.y + box.height / 2;

    await touchSwipe(page, { x: box.x + box.width * 0.85, y }, { x: box.x + box.width * 0.15, y });

    expect(offsets).toContain(await settledScrollLeft(container));
  });

  test('the previous and next buttons stay rendered and aria-hidden on a touch device', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);

    await expect(root.locator(PREVIOUS_BUTTON)).toBeAttached();
    await expect(root.locator(NEXT_BUTTON)).toBeAttached();
    await expect(root.locator(NEXT_BUTTON)).toHaveAttribute('aria-hidden', 'true');
    await expect(root.locator(DOT).first()).toHaveAttribute('aria-hidden', 'true');
  });
});
