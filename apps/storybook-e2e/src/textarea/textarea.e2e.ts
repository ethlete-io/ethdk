import { Locator, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-textarea--default';
const FIXED_MAX_ROWS_ID = 'components-forms-textarea--fixed-with-max-rows';
const MANUAL_RESIZE_ID = 'components-forms-textarea--manual-resize';

const clientHeight = (field: Locator): Promise<number> => field.evaluate((el) => el.clientHeight);

test.describe('textarea / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the textarea and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-textarea-native');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('textarea / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing behavior');

  test('typing several lines grows the auto-resizing textarea', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-textarea-native');

    await pressKey(page, 'Tab');
    const before = await clientHeight(field);

    await field.pressSequentially('one\ntwo\nthree\nfour\nfive\nsix');

    await expect.poll(() => clientHeight(field)).toBeGreaterThan(before);
  });

  test('the fixed-with-max-rows story stops growing at its max rows and scrolls', async ({ page }) => {
    const root = await openStory(page, FIXED_MAX_ROWS_ID);
    const field = root.locator('.et-textarea-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight');
    const capped = await clientHeight(field);

    await field.pressSequentially('\nnine\nten\neleven\ntwelve');

    await expect.poll(() => clientHeight(field)).toBe(capped);
    const scrollHeight = await field.evaluate((el) => el.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(capped);
  });

  test('the manual-resize story keeps the native resize handle instead of autosizing', async ({ page }) => {
    const root = await openStory(page, MANUAL_RESIZE_ID);
    const field = root.locator('.et-textarea-native');

    await expect(field).toHaveAttribute('data-resize', 'vertical');
    await expect(field).toHaveCSS('resize', 'vertical');
  });

  test('Enter inserts a newline instead of submitting', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-textarea-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('line one');
    await pressKey(page, 'Enter');
    await field.pressSequentially('line two');

    await expect(field).toHaveValue('line one\nline two');
  });
});

test.describe('textarea / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap focuses the textarea', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-textarea-native');

    await tap(field);

    await expect(field).toBeFocused();
  });
});
