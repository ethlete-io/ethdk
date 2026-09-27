import { Locator, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, expectTouchMode, openStory, pressKey, touchSwipe } from '../support';

const DEFAULT_STORY_ID = 'components-layout-scrollable--default';
const VERTICAL_STORY_ID = 'components-layout-scrollable--vertical';
const NAVIGATION_STORY_ID = 'components-layout-scrollable--with-navigation';
const SNAP_STORY_ID = 'components-layout-scrollable--with-snap';
const FOOTER_BUTTONS_STORY_ID = 'components-layout-scrollable--footer-buttons';
const STICKY_BUTTONS_STORY_ID = 'components-layout-scrollable--sticky-buttons';
const BORDER_MASK_STORY_ID = 'components-layout-scrollable--border-mask';

const HOST = '.et-scrollable';
const CONTAINER = '.et-scrollable-container';
const FOOTER = '.et-scrollable-footer';
const ITEM = '.et-sb-scrollable-item';
const PREVIOUS_BUTTON = '.et-scrollable-button--start';
const NEXT_BUTTON = '.et-scrollable-button--end';
const DOT = '.et-scrollable-navigation-item';
const SENTINEL = '.et-scroll-observer-first-element';
const START_MASK = '.et-scrollable-mask--start';
const END_MASK = '.et-scrollable-mask--end';
const DOTS_CONTAINER = '.et-scrollable-dots-container';

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

function scrollTrackTo(container: Locator, to: 'start' | 'middle' | 'end'): Promise<void> {
  return container.evaluate((el, target) => {
    const max = el.scrollWidth - el.clientWidth;
    el.scrollLeft = { start: 0, middle: max / 2, end: max }[target];
  }, to);
}

function maskOpacities(root: Locator): Promise<[number, number]> {
  return Promise.all([
    root.locator(START_MASK).evaluate((el) => Number(getComputedStyle(el).opacity)),
    root.locator(END_MASK).evaluate((el) => Number(getComputedStyle(el).opacity)),
  ]);
}

function childOffsets(root: Locator): Promise<{ start: number; end: number; width: number }[]> {
  return root.locator(CONTAINER).evaluate((container) => {
    const box = container.getBoundingClientRect();

    return [...container.querySelectorAll('.et-sb-scrollable-item')].map((item) => {
      const rect = item.getBoundingClientRect();

      return { start: Math.round(rect.left - box.left), end: Math.round(rect.right - box.left), width: box.width };
    });
  });
}

async function expectAChildCentred(root: Locator): Promise<void> {
  await expect
    .poll(async () =>
      (await childOffsets(root)).some((child) => Math.abs((child.start + child.end) / 2 - child.width / 2) <= 1),
    )
    .toBe(true);
}

/** Samples `scrollLeft` once per frame after a click, so a smooth scroll shows its in-between positions. */
function sampleScrollAfterClick(root: Locator, frames: number): Promise<number[]> {
  return root.locator(HOST).evaluate(async (host, count) => {
    const container = host.querySelector('.et-scrollable-container');
    host.querySelector<HTMLElement>('.et-scrollable-button--end')?.click();
    const samples: number[] = [];

    for (let frame = 0; frame < count; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(Math.round(container?.scrollLeft ?? 0));
    }

    return samples;
  }, frames);
}

function translateOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
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

    const box = await boxOf(container);

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

test.describe('scrollable / edges and chrome', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: desktop viewport sizes');

  test('the gradient masks show only on the edges that still have content beyond them', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 720 });
    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(CONTAINER);

    await scrollTrackTo(container, 'start');
    await expect.poll(() => maskOpacities(root)).toEqual([0, 1]);

    await scrollTrackTo(container, 'middle');
    await expect.poll(() => maskOpacities(root)).toEqual([1, 1]);

    await scrollTrackTo(container, 'end');
    await expect.poll(() => maskOpacities(root)).toEqual([1, 0]);

    expect(await root.locator(START_MASK).evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
      'linear-gradient',
    );
  });

  test('the border mask variant draws an edge line instead of a gradient', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 720 });
    const root = await openStory(page, BORDER_MASK_STORY_ID);

    await scrollTrackTo(root.locator(CONTAINER), 'middle');
    await expect.poll(() => maskOpacities(root)).toEqual([1, 1]);

    const style = await root.locator(START_MASK).evaluate((el) => {
      const computed = getComputedStyle(el);

      return { backgroundImage: computed.backgroundImage, borderWidth: computed.borderInlineStartWidth };
    });
    expect(style).toEqual({ backgroundImage: 'none', borderWidth: '1px' });
  });

  test('the next button scrolls smoothly through in-between positions', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await scrollTrackTo(root.locator(CONTAINER), 'start');
    await expect(root.locator(NEXT_BUTTON)).toBeEnabled();

    const samples = await sampleScrollAfterClick(root, 40);
    const final = samples.at(-1) ?? 0;
    const inBetween = new Set(samples.filter((value) => value > 0 && value < final));

    expect(final).toBeGreaterThan(0);
    expect(inBetween.size).toBeGreaterThan(2);
  });

  test('sticky buttons hold their place in the viewport while the page scrolls past a tall track', async ({ page }) => {
    const root = await openStory(page, STICKY_BUTTONS_STORY_ID);
    const next = root.locator(NEXT_BUTTON);
    const container = root.locator(CONTAINER);

    await expect(root.locator(HOST)).toHaveClass(/et-scrollable--sticky-buttons/);
    const before = { button: (await boxOf(next)).y, track: (await boxOf(container)).y };

    await page.evaluate(() => window.scrollBy(0, 150));
    await expect.poll(async () => (await boxOf(container)).y).toBeLessThan(before.track - 100);

    expect(Math.abs((await boxOf(next)).y - before.button)).toBeLessThanOrEqual(1);
  });

  test('past five dots the dot track slides so the active dot stays inside the visible window', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_STORY_ID);
    const container = root.locator(CONTAINER);
    const dots = root.locator(DOT);

    expect(await dots.count()).toBeGreaterThan(5);

    await scrollTrackTo(container, 'start');
    await expect.poll(() => translateOf(root.locator(DOTS_CONTAINER))).toBe(0);

    await scrollTrackTo(container, 'end');
    await expect.poll(() => translateOf(root.locator(DOTS_CONTAINER))).toBeLessThan(0);
    await expect(dots.last()).toHaveClass(/et-scrollable-navigation-item--active/);

    const bar = await boxOf(root.locator('.et-scrollable-progress-bar'));
    await expect
      .poll(async () => {
        const dot = await boxOf(dots.last());

        return dot.x >= bar.x - 1 && dot.x + dot.width <= bar.x + bar.width + 1;
      })
      .toBe(true);
  });

  test('a vertical track scrolls on the block axis from its next button', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const container = root.locator(CONTAINER);
    await container.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(root.locator(NEXT_BUTTON)).toBeEnabled();

    await root.locator(NEXT_BUTTON).click();

    await expect.poll(() => readScrollTop(container)).toBeGreaterThan(0);
    expect(await readScrollLeft(container)).toBe(0);
  });
});

test.describe('scrollable / scroll origin and margin', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: button clicks');

  test('scrollOrigin "center" lands the next child in the middle of the track', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 720 });
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { scrollMode: 'element', scrollOrigin: 'center' } });
    await expectAChildCentred(root);
    const before = await readScrollLeft(root.locator(CONTAINER));

    await root.locator(NEXT_BUTTON).click();

    await expect.poll(() => readScrollLeft(root.locator(CONTAINER))).toBeGreaterThan(before);
    await settledScrollLeft(root.locator(CONTAINER));
    await expectAChildCentred(root);
  });

  test('scrollMargin keeps a scrolled-to child that far from the start edge', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 720 });
    const root = await openStory(page, DEFAULT_STORY_ID, {
      args: { scrollMode: 'element', scrollOrigin: 'start', scrollMargin: 40 },
    });

    await settledScrollLeft(root.locator(CONTAINER));

    await expect
      .poll(async () => (await childOffsets(root)).some((child) => Math.abs(child.start - 40) <= 1))
      .toBe(true);
  });
});

test.describe('scrollable / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: swipe gestures');

  test('a swipe scrolls the track', async ({ page }) => {
    await expectTouchMode(page);

    const root = await openStory(page, DEFAULT_STORY_ID);
    const container = root.locator(CONTAINER);

    const box = await boxOf(container);

    const y = box.y + box.height / 2;
    const before = await readScrollLeft(container);

    await touchSwipe(page, { x: box.x + box.width * 0.85, y }, { x: box.x + box.width * 0.15, y });

    await expect.poll(() => readScrollLeft(container)).toBeGreaterThan(before);
  });

  test('a swipe on a snapping track comes to rest on a child or at the end of the track', async ({ page }) => {
    const root = await openStory(page, SNAP_STORY_ID);
    const container = root.locator(CONTAINER);
    const maxScroll = await container.evaluate((el) => el.scrollWidth - el.clientWidth);
    const offsets = [...(await readItemOffsets(root)), maxScroll];

    const box = await boxOf(container);

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
