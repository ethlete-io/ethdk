import { Locator, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, openStory, pressKey, tap } from '../support';

const OTP_DEFAULT_ID = 'components-forms-otp-input--default';
const OTP_MASKED_ID = 'components-forms-otp-input--masked-pin';
const TAG_DEFAULT_ID = 'components-forms-tag-input--default';
const TAG_MAX_TAGS_ID = 'components-forms-tag-input--max-tags';
const TAG_PREFILLED_ID = 'components-forms-tag-input--prefilled';
const NUMBER_DEFAULT_ID = 'components-forms-number-input--default';
const NUMBER_COARSE_ID = 'components-forms-number-input--coarse-and-fine-stepping';
const PASSWORD_DEFAULT_ID = 'components-forms-password-input--default';

/** The OTP input shows focus on the active segment, not on the hidden native input. */
async function expectOtpCaretOn(root: Locator, index: number): Promise<void> {
  await expect(root.locator('.et-otp-input-native')).toBeFocused();
  await expect(root.locator('.et-otp-input-segment').nth(index)).toHaveAttribute('data-caret', 'true');
}

test.describe('text-inputs / otp focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the OTP field and the first segment shows the caret', async ({ page }) => {
    const root = await openStory(page, OTP_DEFAULT_ID);

    await pressKey(page, 'Tab');

    await expectOtpCaretOn(root, 0);
  });
});

test.describe('text-inputs / otp keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing behavior');

  test('typing digits fills segments left to right and the caret advances', async ({ page }) => {
    const root = await openStory(page, OTP_DEFAULT_ID);

    await pressKey(page, 'Tab');
    await page.keyboard.type('12');

    await expect(root.locator('.et-otp-input-segment-char').nth(0)).toHaveText('1');
    await expect(root.locator('.et-otp-input-segment-char').nth(1)).toHaveText('2');
    await expectOtpCaretOn(root, 2);
  });

  test('Backspace removes the last digit and moves the caret back', async ({ page }) => {
    const root = await openStory(page, OTP_DEFAULT_ID);

    await pressKey(page, 'Tab');
    await page.keyboard.type('12');
    await pressKey(page, 'Backspace');

    await expect(root.locator('.et-otp-input-segment-char')).toHaveCount(1);
    await expectOtpCaretOn(root, 1);
  });

  test('a full-length paste fills every segment and fires complete', async ({ page }) => {
    const root = await openStory(page, OTP_DEFAULT_ID);
    const nativeInput = root.locator('.et-otp-input-native');

    await nativeInput.fill('123456');

    await expect(root.locator('.et-otp-input-segment-char')).toHaveCount(6);
    await expect(root.getByText('Completed: 123456')).toBeVisible();
  });

  test('a paste strips separator characters outside the charset', async ({ page }) => {
    const root = await openStory(page, OTP_DEFAULT_ID);
    const nativeInput = root.locator('.et-otp-input-native');

    await nativeInput.fill('123-456');

    await expect(nativeInput).toHaveValue('123456');
  });

  test('the masked story renders dots while the value stays the real digits', async ({ page }) => {
    const root = await openStory(page, OTP_MASKED_ID);

    await pressKey(page, 'Tab');
    await page.keyboard.type('12');

    await expect(root.locator('.et-otp-input-segment-char').first()).toHaveText('•');
    await expect(root.locator('.et-otp-input-native')).toHaveValue('12');
  });
});

test.describe('text-inputs / tag input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the tag text field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, TAG_DEFAULT_ID);
    const field = root.locator('.et-tag-input-field');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('text-inputs / tag input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing behavior');

  test('Enter commits the typed text as a chip and clears the field', async ({ page }) => {
    const root = await openStory(page, TAG_DEFAULT_ID);
    const field = root.locator('.et-tag-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('typescript');
    await pressKey(page, 'Enter');

    await expect(root.locator('et-chip')).toHaveText(['typescript']);
    await expect(field).toHaveValue('');
  });

  test('the comma separator commits the text before it while typing', async ({ page }) => {
    const root = await openStory(page, TAG_DEFAULT_ID);
    const field = root.locator('.et-tag-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('angular,');

    await expect(root.locator('et-chip')).toHaveText(['angular']);
    await expect(field).toHaveValue('');
  });

  test('Backspace on the empty field removes the last chip', async ({ page }) => {
    const root = await openStory(page, TAG_PREFILLED_ID);

    await expect(root.locator('et-chip')).toHaveText(['angular', 'signals']);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Backspace');

    await expect(root.locator('et-chip')).toHaveText(['angular']);
  });

  test('maxTags refuses further tags and locks the empty field', async ({ page }) => {
    const root = await openStory(page, TAG_MAX_TAGS_ID);
    const field = root.locator('.et-tag-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('three');
    await pressKey(page, 'Enter');

    await expect(root.locator('et-chip')).toHaveText(['one', 'two', 'three']);
    await expect(field).toHaveJSProperty('readOnly', true);

    await pressKey(page, 'Enter');

    await expect(root.locator('et-chip')).toHaveCount(3);
  });
});

test.describe('text-inputs / number input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the number field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, NUMBER_DEFAULT_ID);
    const field = root.locator('.et-number-input-native');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('text-inputs / number input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: stepping behavior');

  test('ArrowUp and ArrowDown step the value by `step`', async ({ page }) => {
    const root = await openStory(page, NUMBER_DEFAULT_ID);
    const field = root.locator('.et-number-input-native');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowUp');
    await expect(field).toHaveValue('1');

    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowDown');
    await expect(field).toHaveValue('-1');
  });

  test('Shift+ArrowUp steps ten times the amount, Alt+ArrowUp a tenth', async ({ page }) => {
    const root = await openStory(page, NUMBER_COARSE_ID);
    const field = root.locator('.et-number-input-native');

    await pressKey(page, 'Tab');
    await page.keyboard.press('Shift+ArrowUp');
    await expect(field).toHaveValue('10');

    await page.keyboard.press('Alt+ArrowUp');
    await expect(field).toHaveValue('10.1');
  });

  test('the stepper buttons change the value and disable at the min/max bounds', async ({ page }) => {
    const atMin = await openStory(page, NUMBER_DEFAULT_ID, { args: { stepper: true, min: 0, max: 10, value: 0 } });
    const decrementAtMin = atMin.locator('.et-number-input-stepper-button').nth(0);
    const incrementAtMin = atMin.locator('.et-number-input-stepper-button').nth(1);

    await expect(decrementAtMin).toBeDisabled();
    await expect(incrementAtMin).toBeEnabled();

    await incrementAtMin.click();
    await expect(atMin.locator('.et-number-input-native')).toHaveValue('1');

    const atMax = await openStory(page, NUMBER_DEFAULT_ID, { args: { stepper: true, min: 0, max: 10, value: 10 } });
    const incrementAtMax = atMax.locator('.et-number-input-stepper-button').nth(1);
    const decrementAtMax = atMax.locator('.et-number-input-stepper-button').nth(0);

    await expect(incrementAtMax).toBeDisabled();
    await expect(decrementAtMax).toBeEnabled();
  });
});

test.describe('text-inputs / number input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the increment stepper button steps the value', async ({ page }) => {
    const root = await openStory(page, NUMBER_DEFAULT_ID, { args: { stepper: true, min: 0, max: 10, value: 0 } });
    const increment = root.locator('.et-number-input-stepper-button').nth(1);

    await tap(increment);

    await expect(root.locator('.et-number-input-native')).toHaveValue('1');
  });
});

test.describe('text-inputs / password input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the password field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, PASSWORD_DEFAULT_ID);
    const field = root.locator('.et-password-input-native');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('text-inputs / password input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: reveal toggle');

  test('the reveal button toggles the input type and keeps the typed value intact', async ({ page }) => {
    const root = await openStory(page, PASSWORD_DEFAULT_ID);
    const field = root.locator('.et-password-input-native');
    const reveal = root.locator('.et-password-input-reveal');

    await pressKey(page, 'Tab');
    await field.pressSequentially('hunter2');
    await expect(field).toHaveAttribute('type', 'password');

    await reveal.click();

    await expect(field).toHaveAttribute('type', 'text');
    await expect(field).toHaveValue('hunter2');
    await expect(reveal).toHaveAttribute('aria-pressed', 'true');

    await reveal.click();

    await expect(field).toHaveAttribute('type', 'password');
    await expect(reveal).toHaveAttribute('aria-pressed', 'false');
  });

  test('a click on the reveal button leaves focus on the button', async ({ page }) => {
    const root = await openStory(page, PASSWORD_DEFAULT_ID);
    const reveal = root.locator('.et-password-input-reveal');

    await reveal.click();

    await expect(reveal).toBeFocused();
  });

  test('Enter on a focused reveal button also toggles it', async ({ page }) => {
    const root = await openStory(page, PASSWORD_DEFAULT_ID);
    const field = root.locator('.et-password-input-native');
    const reveal = root.locator('.et-password-input-reveal');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await expect(reveal).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(field).toHaveAttribute('type', 'text');
  });
});

test.describe('text-inputs / password input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the reveal button toggles the input type', async ({ page }) => {
    const root = await openStory(page, PASSWORD_DEFAULT_ID);
    const field = root.locator('.et-password-input-native');
    const reveal = root.locator('.et-password-input-reveal');

    await tap(reveal);

    await expect(field).toHaveAttribute('type', 'text');
    await expect(reveal).toHaveAttribute('aria-pressed', 'true');
  });
});
