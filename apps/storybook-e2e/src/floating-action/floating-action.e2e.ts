import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, countClicks, expectFocusVisible, expectTouchMode, openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-actions-floating-action--default';
const DISABLED_STORY_ID = 'components-actions-floating-action--disabled';

const HOST = '.et-floating-action';
const TRIGGER = '.et-floating-action-trigger';
const ANCHOR = '.et-floating-action-anchor';
const SCOPE = '.et-floating-action-scope';

async function scrollPast(page: Page, selector: string): Promise<void> {
  await page.evaluate((target) => {
    const el = document.querySelector(target);

    if (!el) throw new Error(`no element matched "${target}"`);

    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().bottom + 8, behavior: 'instant' });
  }, selector);
}

async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
}

function position(trigger: Locator): Promise<string> {
  return trigger.evaluate((el) => getComputedStyle(el).position);
}

/** In the flow means the trigger still occupies the space its anchor holds for it. */
function sitsInAnchor(root: Locator): Promise<boolean> {
  return root.evaluate(
    (el, selectors) => {
      const trigger = el.querySelector(selectors.trigger);
      const anchor = el.querySelector(selectors.anchor);

      if (!trigger || !anchor) return false;

      const triggerRect = trigger.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();

      return (
        getComputedStyle(trigger).position !== 'fixed' &&
        triggerRect.top >= anchorRect.top - 1 &&
        triggerRect.bottom <= anchorRect.bottom + 1 &&
        triggerRect.left >= anchorRect.left - 1
      );
    },
    { trigger: TRIGGER, anchor: ANCHOR },
  );
}

function visibility(trigger: Locator): Promise<string> {
  return trigger.evaluate((el) => getComputedStyle(el).visibility);
}

/** Distance from the trigger to the viewport's inline-end and block-end edges, in CSS pixels. */
function cornerGaps(trigger: Locator): Promise<{ inlineEnd: number; blockEnd: number }> {
  return trigger.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const root = document.documentElement;

    return {
      inlineEnd: Math.round(root.clientWidth - rect.right),
      blockEnd: Math.round(root.clientHeight - rect.bottom),
    };
  });
}

function documentTop(root: Locator, selector: string): Promise<number> {
  return root.evaluate((el, target) => {
    const node = el.querySelector(target);

    if (!node) throw new Error(`no element matched "${target}"`);

    return Math.round(node.getBoundingClientRect().top + window.scrollY);
  }, selector);
}

function scale(trigger: Locator): Promise<string> {
  return trigger.evaluate((el) => getComputedStyle(el).scale);
}

/** Every window.scrollY seen on the next `frames` animation frames, starting before `action` runs. */
async function scrollPositionsDuring(page: Page, action: () => Promise<void>, frames = 60): Promise<number[]> {
  await page.evaluate((count) => {
    const samples: number[] = [];
    const record = () => {
      samples.push(Math.round(window.scrollY));

      if (samples.length < count) requestAnimationFrame(record);
    };

    (window as Window & { __scrollSamples?: number[] }).__scrollSamples = samples;
    requestAnimationFrame(record);
  }, frames);

  await action();

  await expect
    .poll(() => page.evaluate(() => (window as Window & { __scrollSamples?: number[] }).__scrollSamples?.length ?? 0))
    .toBeGreaterThanOrEqual(frames);

  return page.evaluate(() => (window as Window & { __scrollSamples?: number[] }).__scrollSamples ?? []);
}

function distinctPositions(samples: number[]): number {
  return new Set(samples).size;
}

test.describe('floating-action / scroll', () => {
  test('the trigger sits in the flow while its anchor is on screen', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'inline');
    expect(await sitsInAnchor(root)).toBe(true);
  });

  test('the trigger pins to the corner once the anchor has scrolled above', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await scrollPast(page, ANCHOR);

    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');
    expect(await position(root.locator(TRIGGER))).toBe('fixed');
    await expect.poll(() => cornerGaps(root.locator(TRIGGER))).toEqual({ inlineEnd: 24, blockEnd: 24 });
  });

  test('the trigger goes away once the scope has scrolled above too', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await scrollPast(page, SCOPE);

    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'hidden');
    await expect.poll(() => visibility(root.locator(TRIGGER))).toBe('hidden');
  });

  test('the trigger returns to the flow when the anchor scrolls back into view', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await scrollPast(page, SCOPE);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'hidden');

    await scrollToTop(page);

    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'inline');
    await expect.poll(() => sitsInAnchor(root)).toBe(true);
    await expect.poll(() => visibility(root.locator(TRIGGER))).toBe('visible');
  });

  test('the trigger is never duplicated as the state changes', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const identity = () => root.locator(TRIGGER).evaluate((el) => (el as HTMLElement & { __id?: number }).__id);

    await root.locator(TRIGGER).evaluate((el) => ((el as HTMLElement & { __id?: number }).__id = 1));

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');
    await expect(root.locator(TRIGGER)).toHaveCount(1);
    expect(await identity()).toBe(1);

    await scrollPast(page, SCOPE);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'hidden');
    await expect(root.locator(TRIGGER)).toHaveCount(1);
    expect(await identity()).toBe(1);
  });

  test('the content after the anchor does not move when the trigger detaches', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const scopeTop = await documentTop(root, SCOPE);
    const anchorHeight = await root.locator(ANCHOR).evaluate((el) => el.getBoundingClientRect().height);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    expect(await documentTop(root, SCOPE)).toBe(scopeTop);
    expect(await root.locator(ANCHOR).evaluate((el) => el.getBoundingClientRect().height)).toBe(anchorHeight);
  });

  test('the floating trigger ends at full size, and the hidden one scales down to nothing', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);
    const inlineWidth = Math.round((await boxOf(trigger)).width);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    await expect.poll(async () => Math.round((await boxOf(trigger)).width)).toBe(inlineWidth);

    await scrollPast(page, SCOPE);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'hidden');

    await expect.poll(() => scale(trigger)).toBe('0');
  });

  test('a disabled floating action keeps the trigger in the flow at any scroll position', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);

    await scrollToBottom(page);

    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'inline');
    expect(await sitsInAnchor(root)).toBe(true);
  });

  test('a reader who asks for less motion gets the position change without the animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const root = await openStory(page, STORY_ID);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    expect(await position(root.locator(TRIGGER))).toBe('fixed');
    expect(await root.locator(TRIGGER).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

    await scrollPast(page, SCOPE);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'hidden');

    expect(await visibility(root.locator(TRIGGER))).toBe('hidden');
  });
});

test.describe('floating-action / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the trigger and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(TRIGGER));
  });

  test('the trigger keeps focus when it starts floating', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);

    await pressKey(page, 'Tab');
    await expect(trigger).toBeFocused();

    await scrollPast(page, ANCHOR);

    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');
    await expect(trigger).toBeFocused();
  });

  test('the tab order does not change once the trigger floats', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    await pressKey(page, 'Tab');

    await expect(root.locator(TRIGGER)).toBeFocused();
  });

  test('a hidden trigger cannot be focused', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);

    await scrollPast(page, SCOPE);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'hidden');
    await expect.poll(() => visibility(trigger)).toBe('hidden');

    await trigger.evaluate((el) => (el as HTMLElement).focus());

    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
  });
});

test.describe('floating-action / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter activates the floating trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    await trigger.focus();
    await countClicks(trigger);

    await pressKey(page, 'Enter');

    await expect(trigger).toHaveJSProperty('__clicks', 1);
  });

  test('Space activates the floating trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    await trigger.focus();
    await countClicks(trigger);

    await pressKey(page, 'Space');

    await expect(trigger).toHaveJSProperty('__clicks', 1);
  });

  test('activating the trigger scrolls back to the top of the region', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    await trigger.focus();
    await pressKey(page, 'Enter');

    await expect(root.getByRole('heading', { name: 'Results' })).toBeInViewport();
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'inline');
  });

  test('scrollToTop glides back over several frames instead of jumping', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);

    await scrollToBottom(page);
    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');
    await trigger.focus();

    const samples = await scrollPositionsDuring(page, () => pressKey(page, 'Enter'));

    expect(distinctPositions(samples)).toBeGreaterThan(3);
    await expect(root.getByRole('heading', { name: 'Results' })).toBeInViewport();
  });
});

test.describe('floating-action / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation and safe-area clearance');

  test('a tap activates the floating trigger and scrolls back to the region', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.locator(TRIGGER);

    await expectTouchMode(page);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    await countClicks(trigger);
    await tap(trigger);

    await expect(trigger).toHaveJSProperty('__clicks', 1);
    await expect(root.getByRole('heading', { name: 'Results' })).toBeInViewport();
  });

  test('the floating trigger clears the bottom inline-end corner of the touch viewport', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await scrollPast(page, ANCHOR);
    await expect(root.locator(HOST)).toHaveAttribute('data-state', 'floating');

    await expect.poll(() => cornerGaps(root.locator(TRIGGER))).toEqual({ inlineEnd: 24, blockEnd: 24 });
  });
});
