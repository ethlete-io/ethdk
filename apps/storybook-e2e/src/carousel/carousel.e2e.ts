import { expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap, touchSwipe } from '../support';

const DEFAULT_STORY_ID = 'components-media-carousel--default';
const LOOP_STORY_ID = 'components-media-carousel--loop';
const AUTOPLAY_STORY_ID = 'components-media-carousel--autoplay';

const TRACK = '.et-carousel-track';
const DOT = '.et-carousel-dot';

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
    await page.waitForTimeout(3500);

    await expect(activeDot).toHaveAttribute('aria-label', 'Go to slide 1');
  });

  test('autoplay pauses while focus is inside the carousel', async ({ page }) => {
    const root = await openStory(page, AUTOPLAY_STORY_ID);
    const activeDot = root.locator(`${DOT}[data-active]`);

    await pressKey(page, 'Tab');
    await expect(activeDot).toHaveAttribute('aria-label', 'Go to slide 1');

    await page.waitForTimeout(3500);

    await expect(activeDot).toHaveAttribute('aria-label', 'Go to slide 1');
  });
});

test.describe('carousel / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: swipe and tap gestures');

  test('a horizontal swipe moves to the next slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const track = root.locator(TRACK);
    const dots = root.locator(DOT);

    const box = await track.boundingBox();
    if (!box) throw new Error('carousel track has no bounding box');

    const y = box.y + box.height / 2;

    await touchSwipe(page, { x: box.x + box.width * 0.8, y }, { x: box.x + box.width * 0.2, y });

    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a tap on an indicator jumps to that slide', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dots = root.locator(DOT);

    await tap(dots.nth(3));

    await expect(dots.nth(3)).toHaveAttribute('aria-current', 'true');
  });
});
