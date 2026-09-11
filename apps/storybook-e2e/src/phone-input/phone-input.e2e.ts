import { Locator, Page, expect, test } from '@playwright/test';
import {
  at,
  expectFieldFocusVisible,
  expectFocusVisible,
  expectTouchMode,
  focusedDescriptor,
  openStory,
  pressKey,
  tabSequence,
  tap,
} from '../support';

const DEFAULT_STORY_ID = 'components-forms-phone-input--default';
const PREFILLED_STORY_ID = 'components-forms-phone-input--prefilled';
const MIXED_STORY_ID = 'components-forms-phone-input--mixed';

const countryTrigger = (root: Locator) => root.locator('.et-phone-input-country-trigger');
const numberField = (root: Locator) => root.locator('.et-phone-input-field');
const dialCode = (root: Locator) => root.locator('.et-phone-input-dial-code');
const countrySearch = (page: Page) => page.getByPlaceholder('Search countries');

async function expectFormValue(root: Locator, value: string): Promise<void> {
  await expect(root.getByText(/^Form value:/)).toHaveText(`Form value: "${value}"`);
}

test.describe('phone-input / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the country trigger first, then the number field', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const stops = await tabSequence(page, 2);

    expect(at(stops, 0).tag).toBe('BUTTON');
    expect(at(stops, 0).role).toBe('combobox');
    expect(at(stops, 1).tag).toBe('INPUT');
  });

  test('the country trigger carries the documented countryLabel as its accessible name', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(countryTrigger(root)).toHaveAttribute('aria-label', 'Select country');
  });

  test('the country trigger draws a visible focus ring', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(countryTrigger(root));
  });

  test('the number field lights the control frame', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(numberField(root));
  });

  test('the clear button shows on a filled focused field and is not a tab stop', async ({ page }) => {
    const root = await openStory(page, PREFILLED_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expect(root.locator('.et-input-clear')).toBeVisible();

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).tag).not.toBe('BUTTON');
  });

  test('a disabled phone input has no tab stop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { disabled: true } });

    await expect(countryTrigger(root)).toBeDisabled();
    await expect(numberField(root)).toBeDisabled();

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
  });
});

test.describe('phone-input / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation and typing');

  for (const key of ['Enter', ' ', 'ArrowDown']) {
    test(`${key === ' ' ? 'Space' : key} opens the country picker and moves focus into its search box`, async ({
      page,
    }) => {
      await openStory(page, DEFAULT_STORY_ID);

      await pressKey(page, 'Tab');
      await pressKey(page, key);

      await expect(page.getByRole('listbox')).toBeVisible();
      await expect(countrySearch(page)).toBeFocused();
      await expect(countrySearch(page)).toHaveAttribute('aria-expanded', 'true');
    });
  }

  test('the picker searches country names and dial codes alike', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await countrySearch(page).pressSequentially('49');

    await expect(page.getByRole('option', { name: /Germany \+49/ })).toBeVisible();

    await countrySearch(page).fill('');
    await countrySearch(page).pressSequentially('Switzer');

    await expect(page.getByRole('option', { name: /Switzerland \+41/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Germany \+49/ })).toBeHidden();
    await expect(dialCode(root)).toHaveText('+49');
  });

  test('a query that matches no country shows the empty row', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await countrySearch(page).pressSequentially('zzzz');

    await expect(page.getByText('No countries found')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  test('Escape closes the picker and returns focus to the country trigger', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(page.getByRole('listbox')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(countryTrigger(root)).toBeFocused();
  });

  test('the first Escape clears the query, the second closes the picker', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await countrySearch(page).pressSequentially('Switzer');
    await pressKey(page, 'Escape');

    await expect(countrySearch(page)).toHaveValue('');
    await expect(page.getByRole('listbox')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('committing a country keeps the national number and hands focus to the number field', async ({ page }) => {
    const root = await openStory(page, PREFILLED_STORY_ID);

    await expect(dialCode(root)).toHaveText('+33');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(countrySearch(page)).toBeFocused();
    await countrySearch(page).pressSequentially('Germany');
    await expect(page.getByRole('option')).toHaveCount(1);
    await pressKey(page, 'Enter');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(dialCode(root)).toHaveText('+49');
    await expectFormValue(root, '+49123456789');
    await expect(numberField(root)).toBeFocused();
  });

  test('the unfocused field groups digits in threes and shows the raw number while focused', async ({ page }) => {
    const root = await openStory(page, PREFILLED_STORY_ID);
    const field = numberField(root);

    await expect(field).toHaveValue('123 456 789');

    await field.focus();

    await expect(field).toHaveValue('123456789');

    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('123 456 789');
  });

  test('a national trunk zero is dropped from the dial-code value', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const field = numberField(root);

    await field.focus();
    await field.pressSequentially('0170123456');

    await expect(field).toHaveValue('0170123456');
    await expectFormValue(root, '+49170123456');

    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('170 123 456');
  });

  test('the 00 international call prefix works like +', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const field = numberField(root);

    await field.focus();
    await field.pressSequentially('0033123456');

    await expectFormValue(root, '+33123456');
    await expect(dialCode(root)).toHaveText('+33');
  });

  test('a typed + number re-derives the country by dial code', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const field = numberField(root);

    await field.focus();
    await field.pressSequentially('+41791234567');

    await expect(field).toHaveValue('+41791234567');
    await expect(dialCode(root)).toHaveText('+41');
    await expectFormValue(root, '+41791234567');
  });

  test('a read-only field stays focusable, refuses typing, and keeps its country picker shut', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { readonly: true } });
    const field = numberField(root);

    await expect(field).toHaveAttribute('readonly', '');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expect(field).toBeFocused();

    await page.keyboard.type('1701234567');

    await expect(field).toHaveValue('');
    await expectFormValue(root, '');

    await countryTrigger(root).focus();
    await pressKey(page, 'Enter');

    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('while mixed, picking a country neither reveals the hidden number nor resolves the mixed state', async ({
    page,
  }) => {
    const root = await openStory(page, MIXED_STORY_ID);
    const field = numberField(root);

    await expect(field).toHaveValue('');
    await expect(field).toHaveAttribute('placeholder', 'Mixed');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(countrySearch(page)).toBeFocused();
    await countrySearch(page).pressSequentially('Austria');
    await expect(page.getByRole('option')).toHaveCount(1);
    await pressKey(page, 'Enter');

    await expect(dialCode(root)).toHaveText('+43');
    await expect(field).toHaveValue('');
    await expect(root.getByText(/^Raw form value:/)).toHaveText('Raw form value: "+491701234567"');
    await expect(root.getByText(/^Mixed:/)).toHaveText('Mixed: true');

    await field.pressSequentially('123456');

    await expect(root.getByText(/^Raw form value:/)).toHaveText('Raw form value: "+43123456"');
    await expect(root.getByText(/^Mixed:/)).toHaveText('Mixed: false');
  });
});

test.describe('phone-input / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('the touch project satisfies the coarse-pointer check', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on the country trigger opens the picker', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await tap(countryTrigger(root));

    await expect(page.getByRole('listbox')).toBeVisible();
  });

  test('a tap on a country commits it and closes the picker', async ({ page }) => {
    const root = await openStory(page, PREFILLED_STORY_ID);

    await tap(countryTrigger(root));
    await tap(page.getByRole('option', { name: /Austria \+43/ }));

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(dialCode(root)).toHaveText('+43');
    await expectFormValue(root, '+43123456789');
  });

  test('a tap on the number field reveals the raw digits', async ({ page }) => {
    const root = await openStory(page, PREFILLED_STORY_ID);
    const field = numberField(root);

    await expect(field).toHaveValue('123 456 789');

    await tap(field);

    await expect(field).toBeFocused();
    await expect(field).toHaveValue('123456789');
  });
});
