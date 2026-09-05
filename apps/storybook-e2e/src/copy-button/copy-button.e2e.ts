import { Page, expect, test } from '@playwright/test';
import { expectFocusVisible, expectTouchMode, openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-actions-button-copy--default';
const COPY_TEXT = 'npm install @ethlete/components';
const RESET_DELAY_MS = 1200;

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** The clipboard text, or `null` when the browser refuses the read. */
async function readClipboard(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return null;
    }
  });
}

test.describe('copy-button / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the copy button and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');

    await pressKey(page, 'Tab');

    await expectFocusVisible(iconButton);
  });

  test('Tab visits the icon copy button, then the text copy button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');
    const textButton = root.locator('button[etCopyButton][et-text-button]');

    await pressKey(page, 'Tab');
    await expect(iconButton).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(textButton).toBeFocused();
  });

  test('copying with the keyboard leaves focus on the button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');

    await iconButton.focus();
    await pressKey(page, 'Enter');

    await expect(iconButton).toHaveAttribute('data-copied', 'true');
    await expect(iconButton).toBeFocused();
  });
});

test.describe('copy-button / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter copies the text and marks the host copied', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');

    await iconButton.focus();
    await pressKey(page, 'Enter');

    await expect(iconButton).toHaveAttribute('data-copied', 'true');
    expect(await readClipboard(page)).toBe(COPY_TEXT);
  });

  test('Space copies the text and marks the host copied', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');

    await iconButton.focus();
    await pressKey(page, 'Space');

    await expect(iconButton).toHaveAttribute('data-copied', 'true');
    expect(await readClipboard(page)).toBe(COPY_TEXT);
  });

  test('the copied state clears again after the reset delay', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');

    await iconButton.focus();
    await pressKey(page, 'Enter');

    await expect(iconButton).toHaveAttribute('data-copied', 'true');
    await expect(iconButton).not.toHaveAttribute('data-copied', 'true', { timeout: RESET_DELAY_MS * 3 });
  });

  test('only the activated button reports the copied state', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');
    const textButton = root.locator('button[etCopyButton][et-text-button]');

    await textButton.focus();
    await pressKey(page, 'Enter');

    await expect(textButton).toHaveAttribute('data-copied', 'true');
    await expect(iconButton).not.toHaveAttribute('data-copied', 'true');
  });

  test('the text copy button swaps its accessible name while copied', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const textButton = root.locator('button[etCopyButton][et-text-button]');

    await expect(textButton).toHaveAccessibleName('Copy');

    await textButton.focus();
    await pressKey(page, 'Enter');

    await expect(textButton).toHaveAccessibleName('Copied!');
    await expect(textButton).toHaveAccessibleName('Copy', { timeout: RESET_DELAY_MS * 3 });
  });

  test('the icon copy button exposes an accessible name', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');

    await expect(iconButton).toHaveAccessibleName(/\S/);
  });
});

test.describe('copy-button / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('a tap copies the text and marks the host copied', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const iconButton = root.locator('button[etCopyButton][et-icon-button]');

    await expectTouchMode(page);

    await tap(iconButton);

    await expect(iconButton).toHaveAttribute('data-copied', 'true');

    expect(await readClipboard(page)).toBe(COPY_TEXT);
  });

  test('a tap swaps the text copy button label and it resets again', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const textButton = root.locator('button[etCopyButton][et-text-button]');

    await tap(textButton);

    await expect(textButton).toHaveText('Copied!');
    await expect(textButton).toHaveText('Copy', { timeout: RESET_DELAY_MS * 3 });
  });
});
