import { expect, test } from '@playwright/test';
import { countClicks, expectFocusVisible, openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-actions-button-surface--default';

test.describe('button / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the button and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(button);
  });

  test('a disabled button is skipped in the tab order', async ({ page }) => {
    await openStory(page, STORY_ID, { args: { disabled: true } });

    await pressKey(page, 'Tab');

    const activeTag = await page.evaluate(() => document.activeElement?.tagName);

    expect(activeTag).toBe('BODY');
  });
});

test.describe('button / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Space activates the focused button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await button.focus();
    await countClicks(button);

    await pressKey(page, 'Space');

    await expect(button).toHaveJSProperty('__clicks', 1);
  });

  test('Enter activates the focused button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await button.focus();
    await countClicks(button);

    await pressKey(page, 'Enter');

    await expect(button).toHaveJSProperty('__clicks', 1);
  });

  test('a loading button stays focusable but its click is blocked', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { loading: true } });
    const button = root.locator('button[et-button]').first();

    await pressKey(page, 'Tab');

    await expect(button).toBeFocused();

    await countClicks(button);

    await pressKey(page, 'Enter');

    await expect(button).toHaveJSProperty('__clicks', 0);
  });
});

test.describe('button / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('a tap activates the button on a touch device', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await countClicks(button);

    await tap(button);

    await expect(button).toHaveJSProperty('__clicks', 1);
  });
});
