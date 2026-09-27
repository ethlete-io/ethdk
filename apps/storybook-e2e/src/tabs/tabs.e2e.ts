import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, settle, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-navigation-tabs-tabs--default';
const DISABLED_STORY_ID = 'components-navigation-tabs-tabs--with-disabled-tabs';
const VERTICAL_STORY_ID = 'components-navigation-tabs-tabs--vertical';
const GROUP_SELECTOR = "et-tab-group[data-size='sm']";

interface HeaderState {
  scrollOffset: number;
  inView: boolean[];
  underlineOn: string | null;
  underlineOffset: number;
  underlineWidthDelta: number;
}

async function headerState(group: Locator): Promise<HeaderState> {
  return group.evaluate((el) => {
    const container = el.querySelector('.et-scrollable-container');
    const underline = el.querySelector('.et-tab-bar-underline--active');
    const trigger = underline?.closest('[role="tab"]');

    if (!container || !underline || !trigger) {
      throw new Error('the tab group has no scroll container or active underline');
    }

    const containerRect = container.getBoundingClientRect();
    const underlineRect = underline.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    return {
      scrollOffset: Math.round(container.scrollLeft),
      inView: [...el.querySelectorAll('[role="tab"]')].map((tab) => {
        const rect = tab.getBoundingClientRect();

        return rect.left >= containerRect.left - 1 && rect.right <= containerRect.right + 1;
      }),
      underlineOn: trigger.textContent?.trim() ?? null,
      underlineOffset: Math.abs(underlineRect.x - triggerRect.x),
      underlineWidthDelta: Math.abs(underlineRect.width - triggerRect.width),
    };
  });
}

async function pressAndDragAway(page: Page, target: Locator): Promise<void> {
  const box = await boxOf(target);

  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 5, box.y + 300);
  await page.mouse.up();
}

test.describe('tabs / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the first tab and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const firstTab = root.locator(GROUP_SELECTOR).locator('[role="tab"]').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(firstTab);
  });

  test('a fully disabled group is skipped in the tab order', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);
    const firstEnabledTab = root.locator('[role="tab"]:not([disabled])').first();

    await pressKey(page, 'Tab');

    await expect(firstEnabledTab).toBeFocused();
  });
});

test.describe('tabs / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: arrow-key navigation');

  test('ArrowRight moves focus without changing the selected tab', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);
    const tabs = group.locator('[role="tab"]');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');

    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  });

  test('ArrowRight wraps from the last tab back to the first', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);
    const tabs = group.locator('[role="tab"]');

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await pressKey(page, 'ArrowRight');

    await expect(tabs.first()).toBeFocused();
  });

  test('ArrowLeft wraps from the first tab to the last', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);
    const tabs = group.locator('[role="tab"]');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowLeft');

    await expect(tabs.last()).toBeFocused();
  });

  test('Home and End jump focus to the first and last tab', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);
    const tabs = group.locator('[role="tab"]');

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect(tabs.last()).toBeFocused();

    await pressKey(page, 'Home');
    await expect(tabs.first()).toBeFocused();
  });

  test('Enter activates the focused tab and its panel replaces the active one', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);
    const tabs = group.locator('[role="tab"]');
    const lastTab = tabs.last();

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await pressKey(page, 'Enter');

    await expect(lastTab).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');

    const panelId = await lastTab.getAttribute('aria-controls');
    const panel = page.locator(`#${panelId}`);

    await expect(panel).not.toHaveAttribute('hidden');
  });
});

test.describe('tabs / keyboard walk', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: arrow-key navigation');

  test('every trigger takes a visible focus ring as the arrows walk the bar', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const tabs = root.locator(GROUP_SELECTOR).locator('[role="tab"]');

    await pressKey(page, 'Tab');
    await expectFocusVisible(tabs.nth(0));
    await pressKey(page, 'ArrowRight');
    await expectFocusVisible(tabs.nth(1));
    await pressKey(page, 'ArrowRight');
    await expectFocusVisible(tabs.nth(2));
  });

  test('each group is a single tab stop, and Tab back lands on the selected trigger after the arrows moved on', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const tabs = root.locator(GROUP_SELECTOR).locator('[role="tab"]');

    const sequence = await tabSequence(page, 2);
    expect(sequence.map((descriptor) => descriptor.text)).toEqual(['First', 'First']);
    await pressKey(page, 'Shift+Tab');
    await expect(tabs.first()).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Shift+Tab');

    await expect(tabs.first()).toBeFocused();
    await pressKey(page, 'ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
  });

  test('arrow keys move from a trigger that holds focus without being selected', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const tabs = root.locator(GROUP_SELECTOR).locator('[role="tab"]');

    await pressAndDragAway(page, tabs.nth(2));
    await expect(tabs.nth(2)).toBeFocused();
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

    await pressKey(page, 'ArrowLeft');

    await expect(tabs.nth(1)).toBeFocused();
  });

  test('a vertical group answers ArrowDown and ArrowUp, and ignores ArrowRight', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const tabs = root.locator(GROUP_SELECTOR).locator('[role="tab"]');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(tabs.first()).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(tabs.nth(1)).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(tabs.first()).toBeFocused();
  });

  test('the underline sits on the selected trigger and moves with the selection', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);

    const initial = await headerState(group);
    expect(initial.underlineOn).toBe('First');
    expect(initial.underlineOffset).toBeLessThanOrEqual(1);
    expect(initial.underlineWidthDelta).toBeLessThanOrEqual(1);
    await expect(group.locator('.et-tab-bar-underline--active')).toHaveCount(1);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await pressKey(page, 'Enter');

    await expect.poll(async () => (await headerState(group)).underlineOn).toBe('Third');
    await expect.poll(async () => (await headerState(group)).underlineOffset).toBeLessThanOrEqual(1);
    expect((await headerState(group)).underlineWidthDelta).toBeLessThanOrEqual(1);
    await expect(group.locator('.et-tab-bar-underline--active')).toHaveCount(1);
  });
});

test.describe('tabs / overflow', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard and scroll buttons');

  test('the arrow keys scroll the focused trigger of an overflowing bar into view', async ({ page }) => {
    await page.setViewportSize({ width: 200, height: 720 });
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);

    expect((await headerState(group)).inView).toEqual([true, false, false]);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect.poll(async () => (await headerState(group)).inView[2]).toBe(true);
    expect((await headerState(group)).scrollOffset).toBeGreaterThan(0);

    await pressKey(page, 'Home');
    await expect.poll(async () => (await headerState(group)).scrollOffset).toBe(0);
    expect((await headerState(group)).inView[0]).toBe(true);
  });

  test('the scroll buttons stay out of the tab order and are disabled at their end', async ({ page }) => {
    await page.setViewportSize({ width: 200, height: 720 });
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);
    const start = group.locator('.et-scrollable-button--start');
    const end = group.locator('.et-scrollable-button--end');

    await expect(start).toHaveAttribute('tabindex', '-1');
    await expect(end).toHaveAttribute('tabindex', '-1');
    await expect(start).toBeDisabled();
    await expect(end).toBeEnabled();

    await end.click();

    await expect.poll(async () => (await headerState(group)).scrollOffset).toBeGreaterThan(0);
    await expect(start).toBeEnabled();
    await expect(root.locator(GROUP_SELECTOR).locator('[role="tab"]').first()).toHaveAttribute('aria-selected', 'true');

    await start.click();
    await expect.poll(async () => (await headerState(group)).scrollOffset).toBe(0);
    await settle(page, 100);
    await expect(start).toBeDisabled();
  });
});

test.describe('tabs / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap selection');

  test('a tap selects the tapped tab', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP_SELECTOR);
    const secondTab = group.locator('[role="tab"]').nth(1);

    await tap(secondTab);

    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  });
});
