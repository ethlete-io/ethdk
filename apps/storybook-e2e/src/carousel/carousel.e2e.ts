import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, settle, tap, touchDrag } from '../support';

const DEFAULT_STORY_ID = 'components-media-carousel--default';
const LOOP_STORY_ID = 'components-media-carousel--loop';
const AUTOPLAY_STORY_ID = 'components-media-carousel--autoplay';
const DIM_STORY_ID = 'components-media-carousel--dim-transition';
const WIPE_STORY_ID = 'components-media-carousel--wipe-transition';

const TRACK = '.et-carousel-track';
const DOT = '.et-carousel-dot';

/** A swipe paced like a hand: its momentum carries one slide, no further. */
const UNHURRIED_STEP_MS = 48;
/** A flick whose momentum carries a short swipe on to the next slide. */
const FLICK_STEP_MS = 16;

interface SlideState {
  isClone: boolean;
  isActive: boolean;
  opacity: number;
  offset: number;
  endOffset: number;
  contentTranslate: string;
  veilOpacity: number;
}

function slideStates(root: Locator): Promise<SlideState[]> {
  return root.locator('.et-carousel').evaluate((carousel) => {
    const viewport = carousel.querySelector('.et-scrollable-container');
    const viewportLeft = viewport?.getBoundingClientRect().left ?? 0;
    const viewportRight = viewport?.getBoundingClientRect().right ?? 0;

    return [...carousel.querySelectorAll<HTMLElement>('.et-carousel-item')].map((item) => {
      const content = item.querySelector('.et-carousel-slide-content');

      return {
        isClone: item.hasAttribute('data-clone'),
        isActive: item.hasAttribute('data-active'),
        opacity: Number(getComputedStyle(item).opacity),
        offset: Math.round(item.getBoundingClientRect().left - viewportLeft),
        endOffset: Math.round(viewportRight - item.getBoundingClientRect().right),
        contentTranslate: content ? getComputedStyle(content).translate : '',
        veilOpacity: Number(getComputedStyle(item, '::after').opacity),
      };
    });
  });
}

async function activeSlide(root: Locator): Promise<SlideState> {
  const states = await slideStates(root);
  const active = states.find((state) => state.isActive);

  if (!active) throw new Error('No slide carries data-active.');

  return active;
}

async function expectActiveSlideAtRest(root: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const active = await activeSlide(root);

      return { isClone: active.isClone, offset: Math.abs(active.offset) <= 1 };
    })
    .toEqual({ isClone: false, offset: true });
}

async function expectActiveSlideAtRtlRest(root: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const active = await activeSlide(root);

      return { isClone: active.isClone, endOffset: Math.abs(active.endOffset) <= 1 };
    })
    .toEqual({ isClone: false, endOffset: true });
}

async function scrollTrackBy(root: Locator, fraction: number): Promise<void> {
  await root.locator('.et-scrollable-container').evaluate((viewport, by) => {
    (viewport as HTMLElement).style.scrollSnapType = 'none';
    viewport.scrollLeft += viewport.clientWidth * by;
  }, fraction);
}

async function isLastRealSlideAtRest(root: Locator): Promise<boolean> {
  const states = await slideStates(root);
  const lastReal = states[states.map((state) => state.isClone).lastIndexOf(false)];

  return !!lastReal?.isActive && Math.abs(lastReal.offset) <= 1;
}

async function recordVisitedDots(dots: Locator): Promise<void> {
  await dots.evaluateAll((all) => {
    const visited: number[] = [];

    new MutationObserver(() => {
      const index = all.findIndex((dot) => dot.getAttribute('aria-current') === 'true');

      if (visited.at(-1) !== index) visited.push(index);
    }).observe(all[0]?.parentElement as HTMLElement, { attributes: true, subtree: true });

    Object.assign(window, { visitedDots: visited });
  });
}

function visitedDots(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { visitedDots: number[] }).visitedDots);
}

async function mouseDragTrack(page: Page, root: Locator, from: number, to: number): Promise<void> {
  const box = await boxOf(root.locator(TRACK));
  const y = box.y + box.height / 2;

  await page.mouse.move(box.x + box.width * from, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to, y, { steps: 12 });
  await page.mouse.up();
}

async function pacedMouseDrag(
  page: Page,
  root: Locator,
  options: { from: number; distance: number; steps: number; stepMs: number; whileDown?: () => Promise<void> },
): Promise<void> {
  const box = await boxOf(root.locator(TRACK));
  const y = box.y + box.height / 2;
  const start = box.x + box.width * options.from;

  await page.mouse.move(start, y);
  await page.mouse.down();
  for (let step = 1; step <= options.steps; step++) {
    await settle(page, options.stepMs);
    await page.mouse.move(start - (options.distance * step) / options.steps, y);
  }
  await options.whileDown?.();
  await page.mouse.up();
}

function activeContentOffset(root: Locator): Promise<number> {
  return root.locator('.et-carousel').evaluate((carousel) => {
    const viewportLeft = carousel.querySelector('.et-scrollable-container')?.getBoundingClientRect().left ?? 0;
    const content = carousel.querySelector('.et-carousel-item[data-active] .et-carousel-slide-content');

    return Math.round((content?.getBoundingClientRect().left ?? NaN) - viewportLeft);
  });
}

async function sweepAnimationName(dot: Locator): Promise<string> {
  return dot
    .locator('.et-carousel-dot-progress-half')
    .first()
    .evaluate((half) => getComputedStyle(half, '::before').animationName);
}

async function expectReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
}

test.describe('carousel / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the previous control and its focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const previous = root.getByRole('button', { name: 'Previous slide' });

    // The scrollable track is the first tab stop.
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(previous);
  });

  test('Tab continues on to a dot indicator with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const firstDot = root.locator(DOT).first();

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(firstDot);
  });
});

test.describe('carousel / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: native scrolling and pointer interactions');

  test('ArrowRight on the focused track moves to the next slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dots = root.locator(DOT);

    await pressKey(page, 'Tab');
    await page.keyboard.press('ArrowRight');

    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(dots.first()).not.toHaveAttribute('aria-current', 'true');
  });

  test('ArrowLeft on the focused track moves back to the previous slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dots = root.locator(DOT);

    await pressKey(page, 'Tab');
    await page.keyboard.press('ArrowRight');
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('ArrowLeft');

    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  });

  test('the previous control is aria-disabled on the first slide when loop is off', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { loop: false } });
    const previous = root.getByRole('button', { name: 'Previous slide' });

    await expect(previous).toHaveAttribute('aria-disabled', 'true');
  });

  test('the previous control stays enabled at the first slide when loop is on', async ({ page }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const previous = root.getByRole('button', { name: 'Previous slide' });

    await expect(previous).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('a click on a dot moves the carousel to that slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dots = root.locator(DOT);

    await dots.nth(2).click();

    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
  });

  test('autoplay pauses while the pointer hovers the carousel', async ({ page }) => {
    const root = await openStory(page, AUTOPLAY_STORY_ID);
    const track = root.locator(TRACK);
    const activeDot = root.locator(`${DOT}[data-active]`);

    await expect(activeDot).toHaveAttribute('aria-label', 'Go to slide 1');

    await track.hover();
    await settle(page, 3500);

    await expect(activeDot).toHaveAttribute('aria-label', 'Go to slide 1');
  });

  test('autoplay pauses while focus is inside the carousel', async ({ page }) => {
    const root = await openStory(page, AUTOPLAY_STORY_ID);
    const activeDot = root.locator(`${DOT}[data-active]`);

    await pressKey(page, 'Tab');
    await expect(activeDot).toHaveAttribute('aria-label', 'Go to slide 1');

    await settle(page, 3500);

    await expect(activeDot).toHaveAttribute('aria-label', 'Go to slide 1');
  });
});

test.describe('carousel / loop', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: control clicks');

  test('Previous on the first slide wraps to the last and settles on the real slide, not its clone', async ({
    page,
  }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const dots = root.locator(DOT);

    await root.getByRole('button', { name: 'Previous slide' }).click();

    await expect(dots.last()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRest(root);
  });

  test('Next on the last slide wraps to the first and settles on the real slide, not its clone', async ({ page }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const dots = root.locator(DOT);

    await dots.last().click();
    await expect(dots.last()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRest(root);

    await root.getByRole('button', { name: 'Next slide' }).click();

    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRest(root);
  });

  test('a mouse drag backward on the first slide crosses the seam without sweeping through every slide', async ({
    page,
  }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const dots = root.locator(DOT);

    await recordVisitedDots(dots);
    await mouseDragTrack(page, root, 0.2, 0.8);

    await expect(dots.last()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRest(root);
    await settle(page, 1000);

    const visited = await visitedDots(page);

    expect(visited).toContain((await dots.count()) - 1);
    expect(new Set(visited).size).toBeLessThanOrEqual(2);
  });

  test('a mouse drag forward on the last slide crosses the seam without sweeping through every slide', async ({
    page,
  }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const dots = root.locator(DOT);

    await dots.last().click();
    await expect.poll(() => isLastRealSlideAtRest(root)).toBe(true);

    await recordVisitedDots(dots);
    await mouseDragTrack(page, root, 0.8, 0.2);

    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRest(root);
    await settle(page, 1000);

    const visited = await visitedDots(page);

    expect(visited).toContain(0);
    expect(new Set(visited).size).toBeLessThanOrEqual(2);
  });
});

test.describe('carousel / loop in RTL', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: control clicks');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.dir = 'rtl';
      });
    });
  });

  test('starts on the first real slide rather than a leading clone', async ({ page }) => {
    const root = await openStory(page, LOOP_STORY_ID);

    await expect(root.locator(DOT).first()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRtlRest(root);
  });

  test('wraps both ways across the seam and settles on real slides', async ({ page }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const dots = root.locator(DOT);

    await root.getByRole('button', { name: 'Previous slide' }).click();

    await expect(dots.last()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRtlRest(root);

    await root.getByRole('button', { name: 'Next slide' }).click();

    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRtlRest(root);
  });
});

test.describe('carousel / transitions', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: control clicks');

  test('dim keeps the current slide opaque and fades its neighbours, and follows the slide that moves in', async ({
    page,
  }) => {
    const root = await openStory(page, DIM_STORY_ID);

    await expect.poll(async () => (await activeSlide(root)).opacity).toBeGreaterThan(0.95);
    const states = await slideStates(root);
    const activeIndex = states.findIndex((state) => state.isActive);
    expect(states[activeIndex + 1]?.opacity).toBeLessThan(0.9);

    await root.getByRole('button', { name: 'Next slide' }).click();

    await expect.poll(async () => (await slideStates(root))[activeIndex + 1]?.opacity).toBeGreaterThan(0.95);
    await expect.poll(async () => (await slideStates(root))[activeIndex]?.opacity).toBeLessThan(0.9);
  });

  test('wipe holds the current slide content still at rest and pins it while the track moves', async ({ page }) => {
    const root = await openStory(page, WIPE_STORY_ID);

    await expect.poll(async () => (await activeSlide(root)).veilOpacity).toBeLessThan(0.01);
    expect(['0%', '0px', 'none']).toContain((await activeSlide(root)).contentTranslate);

    await scrollTrackBy(root, 0.5);

    await expect.poll(async () => (await activeSlide(root)).veilOpacity).toBeGreaterThan(0.1);
    expect(['0%', '0px', 'none']).not.toContain((await activeSlide(root)).contentTranslate);
  });
});

test.describe('carousel / mouse drag release', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('a quick short flick carries on to the next slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pacedMouseDrag(page, root, { from: 0.6, distance: 100, steps: 5, stepMs: 10 });

    await expectActiveSlideAtRest(root);
    await expect(root.locator(DOT).nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a slow short drag glides back to the slide it started on', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pacedMouseDrag(page, root, { from: 0.6, distance: 100, steps: 10, stepMs: 80 });

    await expectActiveSlideAtRest(root);
    await expect(root.locator(DOT).nth(0)).toHaveAttribute('aria-current', 'true');
  });

  test('wipe keeps the picture still while a slow drag moves the edge', async ({ page }) => {
    const root = await openStory(page, WIPE_STORY_ID);
    const offsets: number[] = [];

    await expectActiveSlideAtRest(root);
    await pacedMouseDrag(page, root, {
      from: 0.8,
      distance: 300,
      steps: 15,
      stepMs: 40,
      whileDown: async () => {
        offsets.push(await activeContentOffset(root));
      },
    });

    expect(offsets).toEqual([0]);
  });
});

test.describe('carousel / autoplay', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover and control clicks');

  test('the active dot runs the countdown ring and autoplay advances when it completes', async ({ page }) => {
    const root = await openStory(page, AUTOPLAY_STORY_ID);
    const dots = root.locator(DOT);

    await page.mouse.move(0, 0);
    await expect(dots.first()).toHaveAttribute('data-counting', '');
    expect(await sweepAnimationName(dots.first())).toBe('et-carousel-autoplay-sweep');
    await expect(dots.nth(1)).not.toHaveAttribute('data-counting', '');

    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 5000 });
    await expect(dots.nth(1)).toHaveAttribute('data-counting', '');
  });

  test('hovering the carousel stops the countdown ring', async ({ page }) => {
    const root = await openStory(page, AUTOPLAY_STORY_ID);
    const firstDot = root.locator(DOT).first();

    await expect(firstDot).toHaveAttribute('data-counting', '');

    await root.locator(TRACK).hover();

    await expect(firstDot).not.toHaveAttribute('data-counting', '');
    expect(await sweepAnimationName(firstDot)).toBe('none');
  });

  test('the pause control stops autoplay until it is pressed again', async ({ page }) => {
    const root = await openStory(page, AUTOPLAY_STORY_ID);
    const dots = root.locator(DOT);
    const toggle = root.locator('.et-carousel-play-toggle');

    await expect(toggle).toHaveAttribute('data-playing', '');
    await toggle.click();
    await page.mouse.move(0, 0);

    await expect(toggle).not.toHaveAttribute('data-playing', '');
    await expect(dots.first()).not.toHaveAttribute('data-counting', '');
    await settle(page, 3500);
    await expect(dots.first()).toHaveAttribute('aria-current', 'true');

    await toggle.click();
    await page.mouse.move(0, 0);

    await expect(toggle).toHaveAttribute('data-playing', '');
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true', { timeout: 5000 });
  });
});

test.describe('carousel / reduced motion', () => {
  test('autoplay never starts under prefers-reduced-motion', async ({ page }) => {
    await expectReducedMotion(page);
    const root = await openStory(page, AUTOPLAY_STORY_ID);
    const dots = root.locator(DOT);

    await expect(root.locator('.et-carousel-play-toggle')).not.toHaveAttribute('data-playing', '');
    await expect(dots.first()).not.toHaveAttribute('data-counting', '');
    await settle(page, 3500);
    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  });

  test('a dim carousel drops its transition under prefers-reduced-motion', async ({ page }) => {
    await expectReducedMotion(page);
    const root = await openStory(page, DIM_STORY_ID);

    await expect(root.locator('.et-carousel')).toHaveAttribute('data-transition-driver', 'none');
    const opacities = (await slideStates(root)).map((state) => state.opacity);
    expect(opacities.every((opacity) => opacity === 1)).toBe(true);
  });
});

test.describe('carousel / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: swipe and tap gestures');

  test('a horizontal swipe moves to the next slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const track = root.locator(TRACK);
    const dots = root.locator(DOT);

    const box = await boxOf(track);

    const y = box.y + box.height / 2;

    await touchDrag(
      page,
      { x: box.x + box.width * 0.8, y },
      { x: box.x + box.width * 0.2, y },
      { stepMs: UNHURRIED_STEP_MS },
    );

    await expectActiveSlideAtRest(root);
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a short swipe comes to rest snapped on the next slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const box = await boxOf(root.locator(TRACK));
    const y = box.y + box.height / 2;

    await touchDrag(
      page,
      { x: box.x + box.width * 0.6, y },
      { x: box.x + box.width * 0.35, y },
      { stepMs: FLICK_STEP_MS },
    );

    await expectActiveSlideAtRest(root);
    await expect(root.locator(DOT).nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a backward swipe on the first slide of a looping carousel wraps to the last', async ({ page }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const box = await boxOf(root.locator(TRACK));
    const y = box.y + box.height / 2;

    await touchDrag(
      page,
      { x: box.x + box.width * 0.2, y },
      { x: box.x + box.width * 0.8, y },
      { stepMs: UNHURRIED_STEP_MS },
    );

    await expectActiveSlideAtRest(root);
    await expect(root.locator(DOT).last()).toHaveAttribute('aria-current', 'true');
  });

  test('swipes in quick succession keep moving a looping carousel past a full lap', async ({ page }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const viewport = root.locator('.et-scrollable-container');
    const box = await boxOf(root.locator(TRACK));
    const y = box.y + box.height / 2;
    const from = box.x + box.width * 0.9;
    const to = box.x + box.width * 0.4;
    const client = await page.context().newCDPSession(page);
    const nextFrame = () => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const scrollLeft = () => viewport.evaluate((element) => element.scrollLeft);
    const moved: number[] = [];

    for (let swipe = 0; swipe < 10; swipe++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
      await nextFrame();

      const start = await scrollLeft();

      for (let step = 1; step <= 3; step++) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: from + ((to - from) * step) / 3, y }],
        });
        await nextFrame();
      }

      moved.push(Math.round((await scrollLeft()) - start));

      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await nextFrame();
    }

    const swipeLength = from - to;

    expect(moved.filter((distance) => distance < swipeLength / 2)).toEqual([]);
  });

  test('a tap on an indicator jumps to that slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dots = root.locator(DOT);

    await tap(dots.nth(3));

    await expect(dots.nth(3)).toHaveAttribute('aria-current', 'true');
  });
});
