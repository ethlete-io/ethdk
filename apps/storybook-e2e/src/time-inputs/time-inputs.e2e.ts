import { Page, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, expectFocusVisible, openStory, pressKey, tap } from '../support';

const TIME_INPUT_DEFAULT = 'components-forms-time-input--default';
const TIME_INPUT_PREFILLED = 'components-forms-time-input--prefilled';
const TIME_INPUT_OPENING_HOURS = 'components-forms-time-input--opening-hours';

const TIME_RANGE_DEFAULT = 'components-forms-time-range-input--default';
const TIME_RANGE_PREFILLED = 'components-forms-time-range-input--prefilled';
const TIME_RANGE_BOUNDED = 'components-forms-time-range-input--bounded';
const TIME_RANGE_MASKED = 'components-forms-time-range-input--masked';

const DURATION_DEFAULT = 'components-forms-duration-input--default';

const FOCUSED_OPTION = "[tabindex='0']";

/** The picker overlay ignores Escape until its enter transition has started. */
async function waitForPickerEntered(page: Page): Promise<void> {
  await expect(page.locator('.et-overlay')).toHaveClass(/et-animation-enter-done/);
}

test.describe('time-inputs / time-input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_DEFAULT);
    const field = root.locator('.et-time-input-field');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('time-inputs / time-input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing and picker behavior');

  test('a lenient bare-digit entry commits on blur and reformats the display', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_DEFAULT);
    const field = root.locator('.et-time-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('930');
    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('9:30 AM');
  });

  test('unparseable text stays visible and flags a parse error on blur', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_DEFAULT);
    const field = root.locator('.et-time-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('not a time');
    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('not a time');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  test('Alt+ArrowDown opens the picker as a named dialog anchored to the field', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_DEFAULT);
    const trigger = root.locator('.et-input-picker-trigger');

    await pressKey(page, 'Tab');
    await page.keyboard.press('Alt+ArrowDown');

    await expect(page.getByRole('dialog', { name: 'Choose a time' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('Escape closes the picker and returns focus to the field', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_DEFAULT);
    const field = root.locator('.et-time-input-field');

    await pressKey(page, 'Tab');
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.getByRole('dialog', { name: 'Choose a time' })).toBeVisible();
    await waitForPickerEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.getByRole('dialog', { name: 'Choose a time' })).toHaveCount(0);
    await expectFieldFocusVisible(field);
  });

  test('completing an hour and a minute in the picker commits the time and the picker stays open', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_DEFAULT);
    const field = root.locator('.et-time-input-field');

    await pressKey(page, 'Tab');
    await page.keyboard.press('Alt+ArrowDown');

    const hour = page.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);
    await expectFocusVisible(hour);

    await pressKey(page, 'Home');
    await expect(hour).toHaveText('12');

    await pressKey(page, 'Tab');
    const minute = page.getByRole('listbox', { name: 'Minutes' }).locator(FOCUSED_OPTION);
    await pressKey(page, 'Home');
    await expect(minute).toHaveText('00');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Home');

    await expect(page.getByRole('dialog', { name: 'Choose a time' })).toBeVisible();
    await expect(field).toHaveValue('12:00 AM');
  });

  test('the opening-hours story bounds the picker but typed entry outside those bounds still commits', async ({
    page,
  }) => {
    const root = await openStory(page, TIME_INPUT_OPENING_HOURS, {
      args: { displayFormat: 'HHmm' },
    });
    const field = root.locator('.et-time-input-field');
    const trigger = root.locator('.et-input-picker-trigger');

    await pressKey(page, 'Tab');
    await field.pressSequentially('300');
    await pressKey(page, 'Tab');
    await expect(field).toHaveValue('0300');

    await trigger.click();

    const hourListbox = page.getByRole('listbox', { name: 'Hours' });
    await expect(hourListbox.getByText('08', { exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(hourListbox.getByText('18', { exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(hourListbox.getByText('09', { exact: true })).not.toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('time-inputs / time-input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the trigger opens the picker as a bottom sheet', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_DEFAULT);
    const trigger = root.locator('.et-input-picker-trigger');

    await tap(trigger);

    const dialog = page.getByRole('dialog', { name: 'Choose a time' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('.et-overlay--bottom-sheet')).toBeVisible();
  });

  test('a tap on the clear button clears a focused field with a value', async ({ page }) => {
    const root = await openStory(page, TIME_INPUT_PREFILLED);
    const field = root.locator('.et-time-input-field');
    const clear = root.locator('.et-input-clear');

    await tap(field);
    await tap(clear);

    await expect(field).toHaveValue('');
  });
});

test.describe('time-inputs / time-range-input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the start field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, TIME_RANGE_DEFAULT);
    const start = root.locator('.et-time-range-input-field[side="start"]');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(start);
  });
});

test.describe('time-inputs / time-range-input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing and picker behavior');

  test('Tab moves from the start field to the end field, and each side commits independently', async ({ page }) => {
    const root = await openStory(page, TIME_RANGE_DEFAULT);
    const start = root.locator('.et-time-range-input-field[side="start"]');
    const end = root.locator('.et-time-range-input-field[side="end"]');

    await pressKey(page, 'Tab');
    await start.pressSequentially('900');

    await pressKey(page, 'Tab');
    await expect(end).toBeFocused();
    await end.pressSequentially('1730');
    await pressKey(page, 'Tab');

    await expect(start).toHaveValue('9:00 AM');
    await expect(end).toHaveValue('5:30 PM');
  });

  test('Alt+ArrowDown opens the range picker as a named dialog labelled group', async ({ page }) => {
    const root = await openStory(page, TIME_RANGE_DEFAULT);

    await pressKey(page, 'Tab');
    await page.keyboard.press('Alt+ArrowDown');

    await expect(page.getByRole('dialog', { name: 'Choose a time range' })).toBeVisible();
    await expect(root.getByRole('group', { name: 'Time range' })).toBeVisible();
  });

  test('picking a time on either side leaves the picker open', async ({ page }) => {
    const root = await openStory(page, TIME_RANGE_PREFILLED);
    const trigger = root.locator('.et-input-picker-trigger');
    const end = root.locator('.et-time-range-input-field[side="end"]');

    await trigger.click();

    const hourListbox = page.getByRole('listbox', { name: 'Hours' });
    await hourListbox.getByText('11', { exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Choose a time range' })).toBeVisible();

    await page.getByRole('button', { name: /^End time/ }).click();
    const minuteListbox = page.getByRole('listbox', { name: 'Minutes' });
    await minuteListbox.getByText('45', { exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Choose a time range' })).toBeVisible();
    await expect(end).toHaveValue('5:45 PM');
  });

  test('the bounded story bounds the picker but typed entry outside those bounds still commits', async ({ page }) => {
    const root = await openStory(page, TIME_RANGE_BOUNDED, { args: { displayFormat: 'HHmm' } });
    const start = root.locator('.et-time-range-input-field[side="start"]');
    const trigger = root.locator('.et-input-picker-trigger');

    await pressKey(page, 'Tab');
    await start.pressSequentially('0200');
    await pressKey(page, 'Tab');
    await expect(start).toHaveValue('0200');

    await trigger.click();

    const hourListbox = page.getByRole('listbox', { name: 'Hours' });
    await expect(hourListbox.getByText('02', { exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(hourListbox.getByText('22', { exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(hourListbox.getByText('10', { exact: true })).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('the masked story shows a guide while empty and auto-inserts the separator while typing', async ({ page }) => {
    const root = await openStory(page, TIME_RANGE_MASKED);
    const start = root.locator('.et-time-range-input-field[side="start"]');

    await pressKey(page, 'Tab');
    await expect(start).toHaveValue('__:__');

    await start.pressSequentially('0930');
    await expect(start).toHaveValue('09:30');
  });
});

test.describe('time-inputs / time-range-input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the trigger opens the range picker as a bottom sheet', async ({ page }) => {
    const root = await openStory(page, TIME_RANGE_PREFILLED);
    const trigger = root.locator('.et-input-picker-trigger');

    await tap(trigger);

    await expect(page.getByRole('dialog', { name: 'Choose a time range' })).toBeVisible();
    await expect(page.locator('.et-overlay--bottom-sheet')).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Hours' })).toBeVisible();
  });
});

test.describe('time-inputs / duration-input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DURATION_DEFAULT);
    const field = root.locator('.et-duration-input-field');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('time-inputs / duration-input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing behavior');

  test('a bare digit run fills from the smallest unit up on blur', async ({ page }) => {
    const root = await openStory(page, DURATION_DEFAULT);
    const field = root.locator('.et-duration-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('130');
    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('01:30');
  });

  test('Enter commits immediately and reformats the field in place', async ({ page }) => {
    const root = await openStory(page, DURATION_DEFAULT);
    const field = root.locator('.et-duration-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('130');
    await pressKey(page, 'Enter');

    await expect(field).toHaveValue('01:30');
    await expect(field).toBeFocused();
  });

  test('unparseable text stays visible and flags a parse error on blur', async ({ page }) => {
    const root = await openStory(page, DURATION_DEFAULT);
    const field = root.locator('.et-duration-input-field');

    await pressKey(page, 'Tab');
    await field.pressSequentially('abc');
    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('abc');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('time-inputs / duration-input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the clear button clears a focused field with a value', async ({ page }) => {
    const root = await openStory(page, DURATION_DEFAULT, { args: { value: 90000 } });
    const field = root.locator('.et-duration-input-field');
    const clear = root.locator('.et-duration-input-clear');

    await tap(field);
    await tap(clear);

    await expect(field).toHaveValue('');
  });
});
