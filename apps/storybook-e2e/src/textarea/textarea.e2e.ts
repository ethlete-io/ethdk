import { Locator, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-textarea--default';
const FIXED_MAX_ROWS_ID = 'components-forms-textarea--fixed-with-max-rows';
const MANUAL_RESIZE_ID = 'components-forms-textarea--manual-resize';
const INPUT_DEFAULT_ID = 'components-forms-input--default';
const INLINE_BOX = { appearance: 'box', labelMode: 'inline' };

const clientHeight = (field: Locator): Promise<number> => field.evaluate((el) => el.clientHeight);

const frameMetrics = (root: Locator) =>
  root.locator('et-form-field').evaluate((field) => {
    const part = (selector: string) => {
      const el = field.querySelector(selector);
      if (!el) throw new Error(`${selector} is missing`);
      return el;
    };
    const frame = part('.et-form-field-control-frame').getBoundingClientRect();
    const labelText = document.createRange();
    labelText.selectNodeContents(part('.et-form-field-label-area--inline'));

    const control = part('input, textarea');

    return {
      frameHeight: frame.height,
      textTop: control.getBoundingClientRect().top + parseFloat(getComputedStyle(control).paddingTop) - frame.top,
      labelTop: labelText.getBoundingClientRect().top - frame.top,
    };
  });

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

test.describe('textarea / layout', () => {
  test('a one-row box textarea with an inline label lines up with the input, empty and filled', async ({ page }) => {
    const input = await openStory(page, INPUT_DEFAULT_ID, { args: INLINE_BOX });
    const inputEmpty = await frameMetrics(input);
    await input.locator('.et-input-native').fill('Hello');
    const inputFilled = await frameMetrics(input);

    const textarea = await openStory(page, DEFAULT_ID, { args: { ...INLINE_BOX, rows: 1 } });
    expect(await frameMetrics(textarea)).toEqual(inputEmpty);
    await textarea.locator('.et-textarea-native').fill('Hello');
    expect(await frameMetrics(textarea)).toEqual(inputFilled);
  });

  test('a box textarea with an inline label keeps its first line beside the label as it grows', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { ...INLINE_BOX, rows: 1 } });
    const field = root.locator('.et-textarea-native');
    const lineHeight = await field.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const one = await frameMetrics(root);
    await field.fill('one\ntwo');
    const two = await frameMetrics(root);

    expect(two).toEqual({ ...one, frameHeight: one.frameHeight + lineHeight });
  });
});

test.describe('textarea / resize grip', () => {
  test('the textarea reaches the frame corner, so its grip sits there and text scrolls to the frame edge', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_ID);
    const inset = await root.locator('et-form-field').evaluate((field) => {
      const frame = field.querySelector('.et-form-field-control-frame');
      const textarea = field.querySelector('textarea');
      if (!frame || !textarea) throw new Error('frame or textarea is missing');

      const border = parseFloat(getComputedStyle(frame).borderTopWidth);
      const [outer, inner] = [frame.getBoundingClientRect(), textarea.getBoundingClientRect()];

      return { end: outer.right - border - inner.right, bottom: outer.bottom - border - inner.bottom };
    });

    expect(inset).toEqual({ end: 0, bottom: 0 });
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
