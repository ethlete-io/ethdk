import { Locator, Page, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, openStory, pressKey, tap } from '../support';

const DATE_INPUT_ID = 'components-forms-date-input--default';
const DATE_INPUT_PREFILLED_ID = 'components-forms-date-input--prefilled';
const DATE_RANGE_INPUT_ID = 'components-forms-date-range-input--default';
const DATE_TIME_INPUT_ID = 'components-forms-date-time-input--default';
const DATE_TIME_RANGE_INPUT_ID = 'components-forms-date-time-range-input--default';

const DIALOG = '[role="dialog"]';
const ENABLED_CELL = ".et-calendar-cell:not([aria-disabled='true'])";
const FOCUSED_CELL = ".et-calendar-weeks:not(.et-calendar-weeks--leave) .et-calendar-cell[tabindex='0']";

/** The picker overlay ignores Escape until its enter transition has started. */
async function waitForPickerEntered(page: Page): Promise<void> {
  await expect(page.locator('.et-overlay')).toHaveClass(/et-animation-enter-done/);
}

/** Presses Tab up to `max` times, stopping once `target` is the active element. */
async function tabUntilFocused(page: Page, target: Locator, max = 10): Promise<void> {
  for (let i = 0; i < max; i++) {
    await pressKey(page, 'Tab');

    if (await target.evaluate((el) => el === document.activeElement)) {
      return;
    }
  }

  throw new Error('Tab never reached the target element');
}

test.describe('date-inputs / date input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the field and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);
    const field = root.locator('.et-date-input-field');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field);
  });
});

test.describe('date-inputs / date input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing and picker interaction');

  test('Alt+ArrowDown opens the picker as a named dialog anchored to the field', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);
    const trigger = root.locator('.et-input-picker-trigger');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Alt+ArrowDown');

    await expect(page.locator(DIALOG)).toHaveAttribute('aria-label', 'Choose a date');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('typing a date and pressing Enter commits it and reformats the field', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);
    const field = root.locator('.et-date-input-field');

    await pressKey(page, 'Tab');
    await page.keyboard.type('07/16/2026');
    await pressKey(page, 'Enter');

    await expect(field).toHaveValue('07/16/2026');
    await expect(root.getByText('Form value: "2026-07-16"')).toBeVisible();
  });

  test('unparseable text stays visible and is announced as invalid once the field is left', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);
    const field = root.locator('.et-date-input-field');

    await pressKey(page, 'Tab');
    await page.keyboard.type('not-a-date');
    await pressKey(page, 'Enter');
    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('not-a-date');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAttribute('aria-describedby', /.+/);
  });

  test('erasing the text and leaving the field clears the value', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_PREFILLED_ID);
    const field = root.locator('.et-date-input-field');

    await pressKey(page, 'Tab');
    await field.fill('');
    await pressKey(page, 'Tab');

    await expect(field).toHaveValue('');
    await expect(root.getByText('Form value: null')).toBeVisible();
  });

  test('Escape closes the picker and returns focus to the field', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);
    const field = root.locator('.et-date-input-field');

    await root.locator('.et-input-picker-trigger').click();
    await waitForPickerEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(field).toBeFocused();
  });

  test('picking a day in the calendar commits the value and closes the picker', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);

    await root.locator('.et-input-picker-trigger').click();
    await page.locator(ENABLED_CELL).first().click();

    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(root.getByText('Form value: null')).toBeHidden();
  });

  test('arrow keys reach the calendar grid inside the picker', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);
    const cell = page.locator(FOCUSED_CELL);

    await root.locator('.et-input-picker-trigger').click();
    await tabUntilFocused(page, cell);
    const initialLabel = await cell.getAttribute('aria-label');

    await pressKey(page, 'ArrowRight');

    await expect(cell).not.toHaveAttribute('aria-label', initialLabel ?? '');
    await expect(cell).toBeFocused();
  });

  test('the clear button appears while the field holds a value and clears it on click', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_PREFILLED_ID);
    const field = root.locator('.et-date-input-field');
    const clear = root.locator('.et-input-clear');

    await pressKey(page, 'Tab');

    await expect(clear).toBeVisible();
    await clear.click();

    await expect(field).toHaveValue('');
    await expect(root.getByText('Form value: null')).toBeVisible();
  });
});

test.describe('date-inputs / date input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the trigger opens the picker as a bottom sheet', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);

    await tap(root.locator('.et-input-picker-trigger'));

    await expect(page.locator(DIALOG)).toBeVisible();
    await expect(page.locator('.et-overlay')).toHaveClass(/et-overlay--bottom-sheet/);

    const handleHeight = await page
      .locator('.et-date-picker-panel')
      .evaluate((el) => getComputedStyle(el, '::before').height);
    expect(handleHeight).toBe('4px');
  });

  test('a tap on a day in the sheet commits the value and closes it', async ({ page }) => {
    const root = await openStory(page, DATE_INPUT_ID);

    await tap(root.locator('.et-input-picker-trigger'));
    await tap(page.locator(ENABLED_CELL).first());

    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(root.getByText('Form value: null')).toBeHidden();
  });
});

test.describe('date-inputs / date range input focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the start field, then the end field, each with a visible ring', async ({ page }) => {
    const root = await openStory(page, DATE_RANGE_INPUT_ID);
    const fields = root.locator('.et-date-range-input-field');

    await pressKey(page, 'Tab');
    await expectFieldFocusVisible(fields.first());

    await pressKey(page, 'Tab');
    await expectFieldFocusVisible(fields.last());
  });
});

test.describe('date-inputs / date range input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing and picker interaction');

  test('typing into each side commits it independently', async ({ page }) => {
    const root = await openStory(page, DATE_RANGE_INPUT_ID);
    const fields = root.locator('.et-date-range-input-field');

    await pressKey(page, 'Tab');
    await page.keyboard.type('07/08/2026');
    await pressKey(page, 'Enter');
    await pressKey(page, 'Tab');
    await page.keyboard.type('07/23/2026');
    await pressKey(page, 'Enter');

    await expect(fields.first()).toHaveValue('07/08/2026');
    await expect(fields.last()).toHaveValue('07/23/2026');
  });

  test('picking a start and end day in the calendar forms a range and closes the picker', async ({ page }) => {
    const root = await openStory(page, DATE_RANGE_INPUT_ID);
    const cells = page.locator(ENABLED_CELL);

    await root.locator('.et-input-picker-trigger').click();
    await cells.nth(10).click();
    await expect(page.locator(DIALOG)).toBeVisible();

    await cells.nth(20).click();

    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(root.locator('.et-date-range-input-field').first()).not.toHaveValue('');
    await expect(root.locator('.et-date-range-input-field').last()).not.toHaveValue('');
  });

  test('Escape closes the picker and returns focus to the start field', async ({ page }) => {
    const root = await openStory(page, DATE_RANGE_INPUT_ID);

    await root.locator('.et-input-picker-trigger').click();
    await waitForPickerEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(root.locator('.et-date-range-input-field').first()).toBeFocused();
  });
});

test.describe('date-inputs / date range input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('tapping two days in the bottom sheet completes the range and closes it', async ({ page }) => {
    const root = await openStory(page, DATE_RANGE_INPUT_ID);
    const cells = page.locator(ENABLED_CELL);

    await tap(root.locator('.et-input-picker-trigger'));
    await tap(cells.nth(10));
    await expect(page.locator(DIALOG)).toBeVisible();

    await tap(cells.nth(20));

    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(root.locator('.et-date-range-input-field').first()).not.toHaveValue('');
  });
});

test.describe('date-inputs / date-time input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: picker layout and merged commits');

  test('opening the picker shows the calendar and time picker side by side, with no tabs', async ({ page }) => {
    const root = await openStory(page, DATE_TIME_INPUT_ID);

    await root.locator('.et-input-picker-trigger').click();

    await expect(page.locator(DIALOG)).toHaveAttribute('aria-label', 'Choose a date and time');
    await expect(page.locator('.et-calendar')).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Hours' })).toBeVisible();
    await expect(page.locator('.et-date-time-input-panel-tabs')).toBeHidden();
  });

  test('picking a day alone holds the value until a time is also picked', async ({ page }) => {
    const root = await openStory(page, DATE_TIME_INPUT_ID);

    await root.locator('.et-input-picker-trigger').click();
    await page.locator(ENABLED_CELL).first().click();

    await expect(page.locator(DIALOG)).toBeVisible();
    await expect(root.getByText('Form value: null')).toBeVisible();

    await page.getByRole('listbox', { name: 'Hours' }).getByText('9', { exact: true }).click();
    await page.getByRole('listbox', { name: 'Minutes' }).getByText('30', { exact: true }).click();

    await expect(page.locator(DIALOG)).toBeVisible();
    await expect(root.getByText('Form value: null')).toBeHidden();
  });
});

test.describe('date-inputs / date-time input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: bottom sheet tabs');

  test('the sheet shows Date/Time tabs, and picking a day advances to the Time tab once', async ({ page }) => {
    const root = await openStory(page, DATE_TIME_INPUT_ID);
    const panes = page.locator('.et-date-time-input-panel-panes');
    const dateTab = page.getByRole('radio', { name: 'Date' });
    const timeTab = page.getByRole('radio', { name: 'Time' });

    await tap(root.locator('.et-input-picker-trigger'));

    await expect(dateTab).toHaveAttribute('aria-checked', 'true');
    await expect(panes).toHaveAttribute('data-active-pane', 'date');

    await tap(page.locator(ENABLED_CELL).first());

    await expect(timeTab).toHaveAttribute('aria-checked', 'true');
    await expect(panes).toHaveAttribute('data-active-pane', 'time');
  });
});

test.describe('date-inputs / date-time range input keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: grouped fields and side switch');

  test('the control is a labelled group with two fields and the time picker side switch', async ({ page }) => {
    const root = await openStory(page, DATE_TIME_RANGE_INPUT_ID);

    await expect(root.locator('et-date-time-range-input')).toHaveAttribute('role', 'group');
    await expect(root.locator('.et-date-time-range-input-field')).toHaveCount(2);

    await root.locator('.et-input-picker-trigger').click();

    const startSide = page.getByRole('button', { name: /Start time/ });
    const endSide = page.getByRole('button', { name: /End time/ });

    await expect(startSide).toHaveAttribute('aria-pressed', 'true');
    await expect(endSide).toHaveAttribute('aria-pressed', 'false');
  });

  test('typing into each side commits it independently', async ({ page }) => {
    const root = await openStory(page, DATE_TIME_RANGE_INPUT_ID);
    const fields = root.locator('.et-date-time-range-input-field');

    await pressKey(page, 'Tab');
    await page.keyboard.type('7/16/2026 930am');
    await pressKey(page, 'Enter');
    await pressKey(page, 'Tab');
    await page.keyboard.type('7/16/2026 530pm');
    await pressKey(page, 'Enter');

    await expect(fields.first()).not.toHaveValue('');
    await expect(fields.last()).not.toHaveValue('');
    await expect(root.getByText('Form value: null')).toBeHidden();
  });
});

test.describe('date-inputs / date-time range input touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: bottom sheet tabs');

  test('the sheet shows Dates/Times tabs, and completing the day range advances to Times once', async ({ page }) => {
    const root = await openStory(page, DATE_TIME_RANGE_INPUT_ID);
    const panes = page.locator('.et-date-time-range-input-panel-panes');
    const cells = page.locator(ENABLED_CELL);
    const timesTab = page.getByRole('radio', { name: 'Times' });

    await tap(root.locator('.et-input-picker-trigger'));
    await expect(panes).toHaveAttribute('data-active-pane', 'dates');

    await tap(cells.nth(10));
    await tap(cells.nth(20));

    await expect(timesTab).toHaveAttribute('aria-checked', 'true');
    await expect(panes).toHaveAttribute('data-active-pane', 'times');
  });
});
