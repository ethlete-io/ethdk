import { expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-date-time-time-picker--default';
const BOUNDED_STORY_ID = 'components-date-time-time-picker--bounded';
const TWELVE_HOUR_STORY_ID = 'components-date-time-time-picker--twelve-hour';
const WITH_SECONDS_STORY_ID = 'components-date-time-time-picker--with-seconds';
const RANGE_STORY_ID = 'components-date-time-time-picker--range';

const FOCUSED_OPTION = "[tabindex='0']";

test.describe('time-picker / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the hour column and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const hour = root.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');

    await expectFocusVisible(hour);
  });
});

test.describe('time-picker / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('Tab moves through the hour, minute and second columns', async ({ page }) => {
    const root = await openStory(page, WITH_SECONDS_STORY_ID);
    const hour = root.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);
    const minute = root.getByRole('listbox', { name: 'Minutes' }).locator(FOCUSED_OPTION);
    const second = root.getByRole('listbox', { name: 'Seconds' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');
    await expect(hour).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(minute).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(second).toBeFocused();
  });

  test('Home and End jump to the first and last hour, and ArrowDown wraps from the last back to the first', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const hour = root.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');

    await pressKey(page, 'Home');
    await expect(hour).toHaveText('00');

    await pressKey(page, 'End');
    await expect(hour).toHaveText('23');

    await pressKey(page, 'ArrowDown');
    await expect(hour).toHaveText('00');
  });

  test('ArrowUp and ArrowDown move the minute value by one step and back', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const minute = root.getByRole('listbox', { name: 'Minutes' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    const initial = await minute.textContent();

    await pressKey(page, 'ArrowDown');
    await expect(minute).not.toHaveText(initial ?? '');

    await pressKey(page, 'ArrowUp');
    await expect(minute).toHaveText(initial ?? '');
  });

  test('typing digits jumps to the matching hour', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const hour = root.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');
    await pressKey(page, '2');
    await pressKey(page, '3');

    await expect(hour).toHaveText('23');
  });

  test('the twelve-hour story toggles its meridiem column between AM and PM', async ({ page }) => {
    const root = await openStory(page, TWELVE_HOUR_STORY_ID);
    const period = root.getByRole('listbox', { name: 'AM/PM' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    const initial = await period.textContent();

    await pressKey(page, 'ArrowDown');
    await expect(period).not.toHaveText(initial ?? '');
    await expect(period).toHaveAttribute('aria-selected', 'true');

    await pressKey(page, 'ArrowDown');
    await expect(period).toHaveText(initial ?? '');
  });

  test('a bounded picker disables hours outside min/max, and Home/End land on the first and last selectable hour', async ({
    page,
  }) => {
    const root = await openStory(page, BOUNDED_STORY_ID);
    const hourListbox = root.getByRole('listbox', { name: 'Hours' });
    const hour = hourListbox.locator(FOCUSED_OPTION);

    await expect(hourListbox.getByText('08', { exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(hourListbox.getByText('18', { exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(hourListbox.getByText('09', { exact: true })).not.toHaveAttribute('aria-disabled', 'true');

    await pressKey(page, 'Tab');

    await pressKey(page, 'Home');
    await expect(hour).toHaveText('09');

    await pressKey(page, 'End');
    await expect(hour).toHaveText('17');
  });

  test('a bounded picker skips disabled hours when arrow navigation wraps', async ({ page }) => {
    const root = await openStory(page, BOUNDED_STORY_ID);
    const hour = root.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect(hour).toHaveText('17');

    await pressKey(page, 'ArrowDown');
    await expect(hour).toHaveText('09');

    await pressKey(page, 'ArrowUp');
    await expect(hour).toHaveText('17');
  });
});

test.describe('time-picker / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on an option selects it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const option = root.getByRole('listbox', { name: 'Minutes' }).getByText('30', { exact: true });

    await tap(option);

    await expect(option).toHaveAttribute('aria-selected', 'true');
  });

  test('a tap on a different hour in the range picker commits it and hops the active side to the end', async ({
    page,
  }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const startSide = root.getByRole('button', { name: /Start time/ });
    const endSide = root.getByRole('button', { name: /End time/ });

    await expect(startSide).toHaveAttribute('aria-pressed', 'true');

    const newHour = root.getByRole('listbox', { name: 'Hours' }).getByText('11', { exact: true });
    await tap(newHour);

    await expect(endSide).toHaveAttribute('aria-pressed', 'true');
    await expect(startSide).toHaveAttribute('aria-pressed', 'false');
  });
});
