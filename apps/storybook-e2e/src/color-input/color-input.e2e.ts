import { Locator, Page, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, expectTouchMode, openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-color-input--default';
const WITH_ALPHA_ID = 'components-forms-color-input--with-alpha';
const WITH_SWATCHES_ID = 'components-forms-color-input--with-swatches';
const READONLY_ID = 'components-forms-color-input--readonly';
const PINNED_NOTATION_ID = 'components-forms-color-input--pinned-notation';
const MIXED_ID = 'components-forms-color-input--mixed';
const CONTRAST_ID = 'components-forms-color-input-contrast--default';

const trigger = (root: Locator) => root.locator('.et-color-input-trigger');
const panel = (page: Page) => page.getByRole('dialog', { name: 'Choose a color' });
const entryField = (page: Page) => panel(page).locator('.et-color-picker-value .et-input-native');
const channel = (page: Page, name: string) => panel(page).getByLabel(name, { exact: true });

/**
 * The overlay ignores Escape until the enter transition has started, and its autofocus lands only
 * once the pane is in. Wait for the pane before pressing a key at the panel.
 */
async function waitForPanelEntered(page: Page): Promise<void> {
  await expect(panel(page)).toBeVisible();
  await expect(page.locator('.et-color-input-overlay-pane')).toHaveClass(/et-animation-enter-done/);
}

async function openPickerWithKeyboard(page: Page): Promise<void> {
  await pressKey(page, 'Tab');
  await pressKey(page, 'Enter');
  await waitForPanelEntered(page);
}

test.describe('color-input / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the trigger and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(trigger(root));
  });

  test('the field is a single tab stop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');
    await expect(trigger(root)).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(trigger(root)).not.toBeFocused();
  });

  test('a readonly field keeps its tab stop', async ({ page }) => {
    const root = await openStory(page, READONLY_ID);

    await pressKey(page, 'Tab');

    await expect(trigger(root)).toBeFocused();
    await expect(trigger(root)).toHaveAttribute('aria-readonly', 'true');
  });

  test('the contrast story exposes both color fields as tab stops', async ({ page }) => {
    const root = await openStory(page, CONTRAST_ID);

    await pressKey(page, 'Tab');
    await expect(trigger(root).first()).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(trigger(root).nth(1)).toBeFocused();
  });
});

test.describe('color-input / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  for (const key of ['Enter', ' ']) {
    test(`${key === ' ' ? 'Space' : key} opens the picker`, async ({ page }) => {
      const root = await openStory(page, DEFAULT_ID);

      await pressKey(page, 'Tab');
      await pressKey(page, key);

      await expect(trigger(root)).toHaveAttribute('aria-expanded', 'true');
      await expect(panel(page)).toBeVisible();
    });
  }

  test('the trigger announces the panel as a dialog it owns', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await expect(trigger(root)).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger(root)).toHaveAttribute('aria-expanded', 'false');
  });

  test('opening moves focus into the panel', async ({ page }) => {
    await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);

    await expect(channel(page, 'Saturation')).toBeFocused();
  });

  test('Escape closes the picker and hands focus back to the field', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);
    await pressKey(page, 'Escape');

    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(root)).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger(root)).toBeFocused();
  });

  test('tabbing on until focus lands outside the field closes the picker', async ({ page }) => {
    const root = await openStory(page, CONTRAST_ID);
    const outside = root.locator('et-switch').first();

    await openPickerWithKeyboard(page);

    for (let i = 0; i < 10 && !(await outside.evaluate((el) => el === document.activeElement)); i++) {
      await pressKey(page, 'Tab');
    }

    await expect(outside).toBeFocused();
    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(root).first()).toHaveAttribute('aria-expanded', 'false');
  });

  // Contradicts the docs: when the field is the page's last tab stop, the Tab past the panel's last
  // control leaves focus on the body and the panel stays open.
  test.fail('a Tab past the panel last control closes the picker', async ({ page }) => {
    await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);
    await panel(page).getByRole('button', { name: 'Pick a color from the screen' }).focus();
    await pressKey(page, 'Tab');

    await expect(panel(page)).toHaveCount(0);
  });

  test('the hue track answers the arrow keys, the page keys, Home and End', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPickerWithKeyboard(page);

    const hue = channel(page, 'Hue');
    await hue.focus();
    const start = Number(await hue.inputValue());

    await pressKey(page, 'ArrowRight');
    await expect.poll(async () => Number(await hue.inputValue())).toBe(start + 1);

    await pressKey(page, 'PageUp');
    await expect.poll(async () => Number(await hue.inputValue())).toBeGreaterThan(start + 1);

    await pressKey(page, 'Home');
    await expect(hue).toHaveValue('0');

    const atHueZero = await trigger(root).innerText();

    // the far end of the track is hue 360, which is the same color as hue 0
    await pressKey(page, 'End');

    await expect(trigger(root)).toHaveText(atHueZero);
  });

  test('the saturation and brightness sliders behind the area answer the arrow keys', async ({ page }) => {
    await openStory(page, PINNED_NOTATION_ID);

    await openPickerWithKeyboard(page);

    const saturation = channel(page, 'Saturation');
    const brightness = channel(page, 'Brightness');

    await saturation.focus();
    const saturationStart = Number(await saturation.inputValue());
    await pressKey(page, 'ArrowRight');
    await expect.poll(async () => Number(await saturation.inputValue())).toBe(saturationStart + 1);

    await brightness.focus();
    const brightnessStart = Number(await brightness.inputValue());
    await pressKey(page, 'ArrowLeft');
    await expect.poll(async () => Number(await brightness.inputValue())).toBe(brightnessStart - 1);
  });

  test('a channel change commits live to the field', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await expect(trigger(root)).toContainText('#3366ff');

    await openPickerWithKeyboard(page);

    const hue = channel(page, 'Hue');
    await hue.focus();
    await pressKey(page, 'End');

    await expect(panel(page)).toBeVisible();
    await expect(trigger(root)).not.toContainText('#3366ff');
  });

  test('Enter in the entry field commits the typed color', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);

    const entry = entryField(page);
    await entry.fill('#ff5533');
    await pressKey(page, 'Enter');

    await expect(trigger(root)).toContainText('#ff5533');
    await expect(panel(page)).toBeVisible();
  });

  test('leaving the entry field commits the typed color', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);

    const entry = entryField(page);
    await entry.fill('#22aa66');
    await entry.blur();

    await expect(trigger(root)).toContainText('#22aa66');
  });

  test('an entry the picker cannot read reverts instead of standing', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPickerWithKeyboard(page);

    const entry = entryField(page);
    await entry.fill('not a color');
    await pressKey(page, 'Enter');

    await expect(entry).toHaveValue('#3366ff');
    await expect(trigger(root)).toContainText('#3366ff');
  });

  test('the entry field reads a color written in another notation', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);

    const entry = entryField(page);
    await entry.fill('rgb(255, 85, 51)');
    await pressKey(page, 'Enter');

    await expect(trigger(root)).toContainText('#ff5533');
  });

  test('the notation switch changes the display only, never the emitted value', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);

    const entry = entryField(page);
    await entry.fill('#ff5533');
    await pressKey(page, 'Enter');

    const notationSwitch = panel(page).getByRole('button', { name: /Change notation/ });
    await expect(notationSwitch).toHaveText('Hex');

    await notationSwitch.click();

    await expect(notationSwitch).toHaveText('RGB');
    await expect(entry).toHaveValue(/^rgb\(/);
    await expect(trigger(root)).toContainText('#ff5533');
  });

  test('a single offered notation pins the field and hides the switch', async ({ page }) => {
    await openStory(page, PINNED_NOTATION_ID);

    await openPickerWithKeyboard(page);

    await expect(panel(page).getByRole('button', { name: /Change notation/ })).toHaveCount(0);
    await expect(panel(page).locator('.et-color-picker-notation')).toHaveText('Hex');
  });

  test('the opacity track is there only with alpha, and the value widens to eight digits', async ({ page }) => {
    await openStory(page, DEFAULT_ID);

    await openPickerWithKeyboard(page);
    await expect(channel(page, 'Opacity')).toHaveCount(0);
    await pressKey(page, 'Escape');

    const withAlpha = await openStory(page, WITH_ALPHA_ID);

    await expect(trigger(withAlpha)).toContainText('#3366ffcc');

    await openPickerWithKeyboard(page);

    const opacity = channel(page, 'Opacity');
    await expect(opacity).toHaveCount(1);

    await opacity.focus();
    await pressKey(page, 'End');

    await expect(trigger(withAlpha)).toContainText(/^#[0-9a-f]{8}$/);
  });

  test('a preset swatch is a tab stop and Enter commits it', async ({ page }) => {
    const root = await openStory(page, WITH_SWATCHES_ID);

    await openPickerWithKeyboard(page);

    const swatch = panel(page).getByRole('button', { name: '#33bb88' });
    await swatch.focus();
    await pressKey(page, 'Enter');

    await expect(trigger(root)).toContainText('#33bb88');
    await expect(swatch).toHaveAttribute('aria-pressed', 'true');
  });

  test('a readonly field refuses to open the picker', async ({ page }) => {
    const root = await openStory(page, READONLY_ID);

    await pressKey(page, 'Tab');
    await expect(trigger(root)).toBeFocused();

    await pressKey(page, 'Enter');
    await page.waitForTimeout(200);

    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(root)).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger(root)).toHaveAttribute('aria-readonly', 'true');
  });

  test('a disabled field is not a tab stop at all', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { disabled: true } });

    await expect(trigger(root)).toBeDisabled();

    await pressKey(page, 'Tab');

    await expect(trigger(root)).not.toBeFocused();
  });

  test('a mixed field masks the raw color until the first pick replaces it', async ({ page }) => {
    const root = await openStory(page, MIXED_ID);

    await expect(trigger(root)).toContainText('Mixed colors');
    await expect(trigger(root)).not.toContainText('#ff5533');

    await openPickerWithKeyboard(page);

    const entry = entryField(page);
    await entry.fill('#0044cc');
    await pressKey(page, 'Enter');

    await expect(trigger(root)).toContainText('#0044cc');
    await expect(root.getByText('Mixed: false')).toBeVisible();
  });
});

test.describe('color-input / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('the touch project satisfies the coarse-pointer check', async ({ page }) => {
    await openStory(page, DEFAULT_ID);

    await expectTouchMode(page);
  });

  test('a tap on the field opens the picker as a bottom sheet', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await tap(trigger(root));

    await expect(trigger(root)).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('.et-color-picker-sheet')).toHaveCount(1);
  });

  test('a tap on a preset swatch commits it', async ({ page }) => {
    const root = await openStory(page, WITH_SWATCHES_ID);

    await tap(trigger(root));
    await tap(panel(page).getByRole('button', { name: '#ffcc00' }));

    await expect(trigger(root)).toContainText('#ffcc00');
  });

  test('a tap outside the sheet closes the picker without restoring focus to the field', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await tap(trigger(root));
    await waitForPanelEntered(page);

    await page.touchscreen.tap(380, 12);

    await expect(panel(page)).toHaveCount(0);
    await expect(trigger(root)).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger(root)).not.toBeFocused();
  });

  test('a readonly field refuses to open on touch too', async ({ page }) => {
    const root = await openStory(page, READONLY_ID);

    await tap(trigger(root));
    await page.waitForTimeout(200);

    await expect(panel(page)).toHaveCount(0);
  });
});
