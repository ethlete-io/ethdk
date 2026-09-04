import { expect, test } from '@playwright/test';
import { expectFieldFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-masked-input--default';
const GUIDE_PLACEHOLDERS_ID = 'components-forms-masked-input--guide-placeholders';
const CURRENCY_ID = 'components-forms-masked-input--currency';
const IBAN_ID = 'components-forms-masked-input--iban';
const MASKED_VALUE_MODE_ID = 'components-forms-masked-input--masked-value-mode';

test.describe('masked-input / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('masked-input / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing behavior');

  test('typing through the mask inserts the literal separators', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('12122024');

    await expect(field).toHaveValue('12-12-2024');
  });

  test('Backspace across a literal removes the digit before it too', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('12');
    await expect(field).toHaveValue('12-');

    await pressKey(page, 'Backspace');

    await expect(field).toHaveValue('1');
  });

  test('a paste with extra characters is stripped to the mask', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await field.fill('31.12.2024xx9999');

    await expect(field).toHaveValue('31-12-2024');
  });

  test('the guide-placeholders story shows unfilled slots while empty and focused', async ({ page }) => {
    const root = await openStory(page, GUIDE_PLACEHOLDERS_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('__-__-____');
  });

  test('the default story keeps the form value raw, without the mask literals', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('12122024');

    await expect(root.getByText('Form value: "12122024"')).toBeVisible();
  });

  test('the masked-value-mode story emits the masked text as the form value', async ({ page }) => {
    const root = await openStory(page, MASKED_VALUE_MODE_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('12122024');

    await expect(root.getByText('Form value: "12-12-2024"')).toBeVisible();
  });

  test('the currency story groups digits and renders the fraction and suffix', async ({ page }) => {
    const root = await openStory(page, CURRENCY_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('1234567,89');

    await expect(field).toHaveValue('1.234.567,89 €');
  });

  test('the iban story uppercases and groups the value by four', async ({ page }) => {
    const root = await openStory(page, IBAN_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('de89370400440532013000');

    await expect(field).toHaveValue('DE89 3704 0044 0532 0130 00');
  });
});

test.describe('masked-input / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap focuses the field and it keeps the default text keyboard', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await tap(field);

    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('type', 'text');
    expect(await field.getAttribute('inputmode')).toBeNull();
  });
});
