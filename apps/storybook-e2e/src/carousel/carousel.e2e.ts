import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, settle, tap, touchSwipe } from '../support';

const DEFAULT_STORY_ID = 'components-media-carousel--default';
const LOOP_STORY_ID = 'components-media-carousel--loop';
const AUTOPLAY_STORY_ID = 'components-media-carousel--autoplay';
const DIM_STORY_ID = 'components-media-carousel--dim-transition';
const WIPE_STORY_ID = 'components-media-carousel--wipe-transition';

const TRACK = '.et-carousel-track';
const DOT = '.et-carousel-dot';

interface SlideState {
  isClone: boolean;
  isActive: boolean;
  opacity: number;
  offset: number;
  contentTranslate: string;
  veilOpacity: number;
}

function slideStates(root: Locator): Promise<SlideState[]> {
  return root.locator('.et-carousel').evaluate((carousel) => {
    const viewport = carousel.querySelector('.et-scrollable-container');
    const viewportLeft = viewport?.getBoundingClientRect().left ?? 0;

    return [...carousel.querySelectorAll<HTMLElement>('.et-carousel-item')].map((item) => {
      const content = item.querySelector('.et-carousel-slide-content');

      return {
        isClone: item.hasAttribute('data-clone'),
        isActive: item.hasAttribute('data-active'),
        opacity: Number(getComputedStyle(item).opacity),
        offset: Math.round(item.getBoundingClientRect().left - viewportLeft),
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

async function scrollTrackBy(root: Locator, fraction: number): Promise<void> {
  await root.locator('.et-scrollable-container').evaluate((viewport, by) => {
    (viewport as HTMLElement).style.scrollSnapType = 'none';
    viewport.scrollLeft += viewport.clientWidth * by;
  }, fraction);
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

    await touchSwipe(page, { x: box.x + box.width * 0.8, y }, { x: box.x + box.width * 0.2, y });

    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a short swipe comes to rest snapped on the next slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const box = await boxOf(root.locator(TRACK));
    const y = box.y + box.height / 2;

    await touchSwipe(page, { x: box.x + box.width * 0.6, y }, { x: box.x + box.width * 0.35, y });

    await expect(root.locator(DOT).nth(1)).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRest(root);
  });

  test('a backward swipe on the first slide of a looping carousel wraps to the last', async ({ page }) => {
    const root = await openStory(page, LOOP_STORY_ID);
    const box = await boxOf(root.locator(TRACK));
    const y = box.y + box.height / 2;

    await touchSwipe(page, { x: box.x + box.width * 0.2, y }, { x: box.x + box.width * 0.8, y });

    await expect(root.locator(DOT).last()).toHaveAttribute('aria-current', 'true');
    await expectActiveSlideAtRest(root);
  });

  test('a tap on an indicator jumps to that slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dots = root.locator(DOT);

    await tap(dots.nth(3));

    await expect(dots.nth(3)).toHaveAttribute('aria-current', 'true');
  });
});
