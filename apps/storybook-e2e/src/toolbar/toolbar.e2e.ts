import { expect, test } from '@playwright/test';
import { countClicks, expectFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-layout-toolbar--default';
const VERTICAL_STORY_ID = 'components-layout-toolbar--vertical';
const DISABLED_STORY_ID = 'components-layout-toolbar--disabled-control';

const CONTROLS = ['Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list', 'Quote', 'Link'];

test.describe('toolbar / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('Tab reaches the toolbar on one control and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const bold = root.getByRole('button', { name: 'Bold' });

    await pressKey(page, 'Tab');

    await expectFocusVisible(bold);
  });

  test('ArrowRight moves through every control and wraps from the last back to the first', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: CONTROLS[0] })).toBeFocused();

    for (let i = 1; i < CONTROLS.length; i++) {
      await pressKey(page, 'ArrowRight');
      await expect(root.getByRole('button', { name: CONTROLS[i] })).toBeFocused();
    }

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: CONTROLS[0] })).toBeFocused();
  });

  test('ArrowLeft wraps from the first control to the last', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowLeft');

    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('Home and End jump focus to the first and last control', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');

    await pressKey(page, 'End');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();

    await pressKey(page, 'Home');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test('arrow navigation skips a disabled control', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Underline' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('ArrowDown and ArrowUp move focus in the vertical toolbar and wrap', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('the vertical toolbar reports its orientation', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);

    await expect(root.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'vertical');
  });

  test('Tab leaves the toolbar after its single tab stop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'Tab');

    const insideToolbar = await page.evaluate(() => !!document.activeElement?.closest('[role="toolbar"]'));
    expect(insideToolbar).toBe(false);
  });

  test('the tab stop stays on the last-focused control across a Tab out and back', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'Tab');
    await pressKey(page, 'Shift+Tab');

    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();
  });
});

test.describe('toolbar / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('a tap activates a control and moves the tab stop to it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const italic = root.getByRole('button', { name: 'Italic' });

    await countClicks(italic);
    await tap(italic);

    await expect(italic).toBeFocused();
    expect(await italic.evaluate((el) => (el as HTMLElement & { __clicks?: number }).__clicks)).toBe(1);
  });
});
