import { CDPSession, Locator, Page, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, openStory, pressKey, settle, tap } from '../support';

const DEFAULT_ID = 'components-forms-masked-input--default';
const GUIDE_PLACEHOLDERS_ID = 'components-forms-masked-input--guide-placeholders';
const CURRENCY_ID = 'components-forms-masked-input--currency';
const IBAN_ID = 'components-forms-masked-input--iban';
const MASKED_VALUE_MODE_ID = 'components-forms-masked-input--masked-value-mode';

function caretOf(field: Locator): Promise<[number | null, number | null]> {
  return field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]);
}

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await pressKey(page, 'ControlOrMeta+V');
}

async function compose(cdp: CDPSession, text: string): Promise<void> {
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
}

/** A keystroke and the start of a composition inside one task, so the keystroke's render is still pending. */
function typeThenStartComposing(el: HTMLInputElement, { typed, composed }: { typed: string; composed: string }): void {
  const insertAtCaret = (text: string) => {
    const caret = el.selectionStart ?? el.value.length;

    el.value = el.value.slice(0, caret) + text + el.value.slice(caret);
    el.setSelectionRange(caret + text.length, caret + text.length);
  };

  insertAtCaret(typed);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: typed }));
  el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
  insertAtCaret(composed);
  el.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: composed, isComposing: true }),
  );
}

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

test.describe('masked-input / clipboard and composition', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard paste and a desktop IME');
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('a real paste into the empty field leaves the caret after the pasted text', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await pasteText(page, '12122024');

    await expect(field).toHaveValue('12-12-2024');
    expect(await caretOf(field)).toEqual([10, 10]);
  });

  test('a paste over a selection replaces it and puts the caret past the next separator', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('12122024');
    await expect(root.getByText('Form value: "12122024"')).toBeVisible();
    await field.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 2));
    await pasteText(page, '31');

    await expect(field).toHaveValue('31-12-2024');
    expect(await caretOf(field)).toEqual([3, 3]);
  });

  test('a paste in the middle drops the rejected characters and leaves the caret after the kept ones', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await pressKey(page, 'Tab');
    await field.pressSequentially('3112');
    await expect(root.getByText('Form value: "3112"')).toBeVisible();
    await field.evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 3));
    await pasteText(page, 'x0');

    await expect(field).toHaveValue('31-01-2');
    expect(await caretOf(field)).toEqual([4, 4]);
  });

  test('an IME composition shows its text untouched, then the commit is masked and reaches the model', async ({
    page,
  }) => {
    const root = await openStory(page, IBAN_ID);
    const field = root.locator('.et-input-native');
    const cdp = await page.context().newCDPSession(page);

    await pressKey(page, 'Tab');
    await field.pressSequentially('DE8937');
    await expect(root.getByText('Form value: "DE8937"')).toBeVisible();

    await compose(cdp, 'x');
    await compose(cdp, 'xy');

    await expect(field).toHaveValue('DE89 37xy');
    await expect(root.getByText('Form value: "DE8937"')).toBeVisible();

    await cdp.send('Input.insertText', { text: 'xy' });

    await expect(field).toHaveValue('DE89 37XY');
    await expect(root.getByText('Form value: "DE8937XY"')).toBeVisible();
  });

  test('a composition that starts right after a keystroke is not cleared by its pending render', async ({ page }) => {
    const root = await openStory(page, IBAN_ID);
    const field = root.locator('.et-input-native');

    await field.focus();
    await field.pressSequentially('DE893');
    await expect(root.getByText('Form value: "DE893"')).toBeVisible();

    await field.evaluate(typeThenStartComposing, { typed: '7', composed: 'x' });
    await settle(page, 200);

    await expect(field).toHaveValue('DE89 37x');

    await field.evaluate((el: HTMLInputElement) =>
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'x' })),
    );

    await expect(field).toHaveValue('DE89 37X');
    await expect(root.getByText('Form value: "DE8937X"')).toBeVisible();
  });
});

test.describe('masked-input / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap focuses a digit-only pattern field and it asks for the numeric keyboard', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const field = root.locator('.et-input-native');

    await tap(field);

    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('type', 'text');
    await expect(field).toHaveAttribute('inputmode', 'numeric');
  });

  test('a tap focuses an alphanumeric mask field and it keeps the default text keyboard', async ({ page }) => {
    const root = await openStory(page, IBAN_ID);
    const field = root.locator('.et-input-native');

    await tap(field);

    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('type', 'text');
    expect(await field.getAttribute('inputmode')).toBeNull();
  });
});
