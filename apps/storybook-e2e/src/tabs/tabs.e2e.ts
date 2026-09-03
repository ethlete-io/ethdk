import { expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-navigation-tabs-tabs--default';
const DISABLED_STORY_ID = 'components-navigation-tabs-tabs--with-disabled-tabs';
const GROUP_SELECTOR = "et-tab-group[data-size='sm']";

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
