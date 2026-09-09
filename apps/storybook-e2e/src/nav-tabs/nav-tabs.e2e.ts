import { Locator, Page, expect, test } from '@playwright/test';
import {
  expectFocusVisible,
  expectTouchMode,
  focusedDescriptor,
  openStory,
  pressKey,
  tabSequence,
  tap,
} from '../support';

const DEFAULT_STORY_ID = 'components-navigation-tabs-nav-tabs--default';
const VERTICAL_STORY_ID = 'components-navigation-tabs-nav-tabs--vertical';
const DISABLED_STORY_ID = 'components-navigation-tabs-nav-tabs--with-disabled-links';

const LABELS = ['One', 'Two', 'Three', 'Four'];

/** The story renders one bar per tab size, all bound to the same routes; every assertion drives the `sm` one. */
const BAR_SELECTOR = "et-nav-tabs[data-size='sm']";

function bar(root: Locator): Locator {
  return root.locator(BAR_SELECTOR);
}

function links(root: Locator): Locator {
  return bar(root).getByRole('tab');
}

interface UnderlineState {
  text: string;
  count: number;
  offset: number;
  widthDelta: number;
}

async function activeUnderline(root: Locator): Promise<UnderlineState | null> {
  return bar(root).evaluate((el) => {
    const underline = el.querySelector('.et-tab-bar-underline--active');
    const link = underline?.closest('a');

    if (!underline || !link) {
      return null;
    }

    const underlineRect = underline.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    return {
      text: link.textContent?.trim() ?? '',
      count: el.querySelectorAll('.et-tab-bar-underline--active').length,
      offset: Math.abs(underlineRect.x - linkRect.x),
      widthDelta: Math.abs(underlineRect.width - linkRect.width),
    };
  });
}

interface ScrollState {
  overflows: boolean;
  scrollOffset: number;
  inView: boolean;
}

async function scrollState(root: Locator, index: number): Promise<ScrollState | null> {
  return bar(root).evaluate((el, i) => {
    const container = el.querySelector('.et-nav-tabs__container');
    const link = el.querySelectorAll('a')[i];

    if (!container || !link) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    return {
      overflows: container.scrollWidth > container.clientWidth,
      scrollOffset: Math.round(container.scrollLeft),
      inView: linkRect.left >= containerRect.left - 1 && linkRect.right <= containerRect.right + 1,
    };
  }, index);
}

async function tabIndexes(root: Locator): Promise<(string | null)[]> {
  return links(root).evaluateAll((els) => els.map((el) => el.getAttribute('tabindex')));
}

/** Taps the element's center through the touchscreen, which a `pointer-events: none` element also receives. */
async function tapThroughScreen(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error('the element has no layout box to tap');
  }

  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function expectRoute(page: Page, root: Locator, label: string, content: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`#/${label.toLowerCase()}$`));
  await expect(root.locator('router-outlet + *')).toHaveText(content);
}

test.describe('nav-tabs / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the active link and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(links(root).first());
  });

  test('every link takes a visible focus ring as the arrows walk the bar', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    for (const label of LABELS) {
      await expect(links(root).filter({ hasText: label })).toBeFocused();
      await expectFocusVisible(links(root).filter({ hasText: label }));
      await pressKey(page, 'ArrowRight');
    }
  });

  test('each bar contributes a single tab stop, the roving one', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    expect(await tabIndexes(root)).toEqual(['0', '-1', '-1', '-1']);

    const descriptors = await tabSequence(page, 4);

    expect(descriptors.slice(0, 3).map((descriptor) => descriptor.text)).toEqual(['One', 'One', 'One']);
    expect(descriptors[3]?.tag).toBe('BODY');
  });

  test('the roving tab stop follows the arrow keys and returns to the active link on focusout', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');

    expect(await tabIndexes(root)).toEqual(['-1', '0', '-1', '-1']);

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).text).toBe('One');
    expect(await tabIndexes(root)).toEqual(['0', '-1', '-1', '-1']);
  });

  test('the overflow scroll buttons stay out of the tab order', async ({ page }) => {
    await page.setViewportSize({ width: 260, height: 720 });
    const root = await openStory(page, DEFAULT_STORY_ID);

    const state = await scrollState(root, 3);
    expect(state?.overflows).toBe(true);
    await expect(bar(root).locator('.et-scrollable-button')).toHaveCount(2);

    const buttonTabIndexes = await bar(root)
      .locator('.et-scrollable-button')
      .evaluateAll((els) => els.map((el) => el.getAttribute('tabindex')));
    expect(buttonTabIndexes).toEqual(['-1', '-1']);

    const descriptors = await tabSequence(page, 4);
    expect(descriptors.slice(0, 3).map((descriptor) => descriptor.text)).toEqual(['One', 'One', 'One']);
    expect(descriptors[3]?.tag).toBe('BODY');
  });
});

test.describe('nav-tabs / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: arrow-key navigation');

  test('the bar is a tablist of links, and only the active one is aria-selected', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(bar(root)).toHaveAttribute('role', 'tablist');
    await expect(bar(root)).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(links(root)).toHaveCount(4);

    const hrefs = await links(root).evaluateAll((els) => els.map((el) => `${el.tagName}:${el.getAttribute('href')}`));
    expect(hrefs).toEqual(['A:#/one', 'A:#/two', 'A:#/three', 'A:#/four']);

    await expect(bar(root).locator('[aria-selected="true"]')).toHaveCount(1);
    await expect(links(root).first()).toHaveAttribute('aria-selected', 'true');
  });

  test('ArrowRight moves focus without navigating', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');

    await expect(links(root).nth(1)).toBeFocused();
    await expect(links(root).first()).toHaveAttribute('aria-selected', 'true');
    await expectRoute(page, root, 'One', 'Route One Content');
  });

  test('ArrowRight wraps from the last link back to the first', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await pressKey(page, 'ArrowRight');

    await expect(links(root).first()).toBeFocused();
  });

  test('ArrowLeft wraps from the first link to the last', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowLeft');

    await expect(links(root).last()).toBeFocused();
  });

  test('Home and End jump focus to the first and last link', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect(links(root).last()).toBeFocused();

    await pressKey(page, 'Home');
    await expect(links(root).first()).toBeFocused();
  });

  test('Enter follows the link the arrow keys moved to and the selection moves with the route', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'Enter');

    await expectRoute(page, root, 'Two', 'Route Two Content');
    await expect(links(root).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(links(root).first()).toHaveAttribute('aria-selected', 'false');
    await expect(links(root).nth(1)).toBeFocused();
  });

  test('Enter follows a link that was focused without the arrow keys', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await links(root).nth(1).focus();
    await pressKey(page, 'Enter');

    await expect(links(root).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expectRoute(page, root, 'Two', 'Route Two Content');
  });

  test('Space follows the focused link', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await links(root).nth(1).focus();
    await pressKey(page, 'Space');

    await expectRoute(page, root, 'Two', 'Route Two Content');
    await expect(links(root).nth(1)).toHaveAttribute('aria-selected', 'true');
  });

  test('a vertical bar answers ArrowDown and ArrowUp, and ignores the inline arrows', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);

    await expect(bar(root)).toHaveAttribute('aria-orientation', 'vertical');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(links(root).nth(1)).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(links(root).nth(1)).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(links(root).first()).toBeFocused();
  });

  test('the underline sits on the active link and moves with the route', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const initial = await activeUnderline(root);
    expect(initial?.text).toBe('One');
    expect(initial?.count).toBe(1);
    expect(initial?.offset).toBeLessThanOrEqual(1);
    expect(initial?.widthDelta).toBeLessThanOrEqual(1);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await pressKey(page, 'Enter');
    await expectRoute(page, root, 'Four', 'Route Four Content');

    await expect.poll(async () => (await activeUnderline(root))?.text).toBe('Four');
    await expect.poll(async () => (await activeUnderline(root))?.offset).toBeLessThanOrEqual(1);

    const moved = await activeUnderline(root);
    expect(moved?.count).toBe(1);
    expect(moved?.widthDelta).toBeLessThanOrEqual(1);
  });

  test('an overflowing bar scrolls the newly active link into view', async ({ page }) => {
    await page.setViewportSize({ width: 260, height: 720 });
    const root = await openStory(page, DEFAULT_STORY_ID);

    const initial = await scrollState(root, 3);
    expect(initial?.overflows).toBe(true);
    expect(initial?.inView).toBe(false);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await pressKey(page, 'Enter');

    await expectRoute(page, root, 'Four', 'Route Four Content');
    await expect.poll(async () => (await scrollState(root, 3))?.inView).toBe(true);
    expect((await scrollState(root, 3))?.scrollOffset).toBeGreaterThan(0);
  });

  test('the arrow keys skip disabled links', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);

    await links(root).first().focus();
    await pressKey(page, 'ArrowRight');

    await expect(links(root).first()).toBeFocused();
    await expectRoute(page, root, 'One', 'Route One Content');
  });

  // Contradicts the docs: `disabled` on an anchor is inert, and the roving tab index still hands the
  // selected link a `tabindex="0"`, so a fully disabled bar keeps a tab stop.
  test.fail('a fully disabled bar is skipped in the tab order', async ({ page }) => {
    await openStory(page, DISABLED_STORY_ID);

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
  });

  test('Space does not follow a disabled link', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);

    await links(root).nth(1).focus();
    await pressKey(page, 'Space');

    await expect(links(root).nth(1)).toHaveAttribute('aria-selected', 'false');
    await expectRoute(page, root, 'One', 'Route One Content');
  });
});

test.describe('nav-tabs / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap follows the link and moves the selection and the underline', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
    await tap(links(root).nth(2));

    await expectRoute(page, root, 'Three', 'Route Three Content');
    await expect(links(root).nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(bar(root).locator('[aria-selected="true"]')).toHaveCount(1);
    await expect.poll(async () => (await activeUnderline(root))?.text).toBe('Three');
  });

  test('a tap on a disabled link does nothing', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);

    await expect(links(root).nth(1)).toHaveAttribute('aria-disabled', 'true');
    await expect(links(root).nth(1)).toHaveCSS('pointer-events', 'none');

    await tapThroughScreen(page, links(root).nth(1));
    await page.waitForTimeout(200);

    await expectRoute(page, root, 'One', 'Route One Content');
    await expect(links(root).first()).toHaveAttribute('aria-selected', 'true');
  });

  test('an overflowing bar keeps the tapped link in view', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const root = await openStory(page, DEFAULT_STORY_ID);

    expect((await scrollState(root, 3))?.overflows).toBe(true);

    await tap(links(root).last());

    await expectRoute(page, root, 'Four', 'Route Four Content');
    await expect.poll(async () => (await scrollState(root, 3))?.inView).toBe(true);
    expect((await scrollState(root, 3))?.scrollOffset).toBeGreaterThan(0);
  });
});
