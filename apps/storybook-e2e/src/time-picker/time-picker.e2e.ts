import { Locator, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, pressKeys, tap, touchSwipe } from '../support';

const DEFAULT_STORY_ID = 'components-date-time-time-picker--default';
const BOUNDED_STORY_ID = 'components-date-time-time-picker--bounded';
const TWELVE_HOUR_STORY_ID = 'components-date-time-time-picker--twelve-hour';
const WITH_SECONDS_STORY_ID = 'components-date-time-time-picker--with-seconds';
const RANGE_STORY_ID = 'components-date-time-time-picker--range';

const FOCUSED_OPTION = "[tabindex='0']";
const SCROLLBAR_VISIBLE = /et-scrollbar--visible/;

/** How far the option sits from the vertical centre of its column's scrollport, in CSS pixels. */
function offCentre(column: Locator, option: string): Promise<number> {
  return column.evaluate((el, selector) => {
    const target = el.querySelector(selector);

    if (!target) return Number.POSITIVE_INFINITY;

    const outer = el.getBoundingClientRect();
    const inner = target.getBoundingClientRect();

    return Math.abs(outer.top + outer.height / 2 - (inner.top + inner.height / 2));
  }, option);
}

function optionsWith(column: Locator, attribute: string): Promise<string[]> {
  return column.evaluate(
    (el, name) => Array.from(el.querySelectorAll(`[${name}]`)).map((option) => option.textContent?.trim() ?? ''),
    attribute,
  );
}

function columnScrollbar(root: Locator, index: number): Locator {
  return root.locator('.et-time-picker-column-wrapper').nth(index).locator('et-scrollbar');
}

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

  test('ArrowRight and ArrowLeft move focus between the columns without changing the value, and stop at the ends', async ({
    page,
  }) => {
    const root = await openStory(page, WITH_SECONDS_STORY_ID);
    const hour = root.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);
    const minute = root.getByRole('listbox', { name: 'Minutes' }).locator(FOCUSED_OPTION);
    const second = root.getByRole('listbox', { name: 'Seconds' }).locator(FOCUSED_OPTION);

    await pressKey(page, 'Tab');
    await expect(hour).toBeFocused();
    const hourText = await hour.innerText();

    await pressKey(page, 'ArrowRight');
    await expect(minute).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(second).toBeFocused();
    await expectFocusVisible(second);

    await pressKey(page, 'ArrowRight');
    await expect(second).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(minute).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'ArrowLeft');
    await expect(hour).toBeFocused();
    await expect(hour).toHaveText(hourText);
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

test.describe('time-picker / layout', () => {
  test('every column opens with its selected option centred in the scrollport', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);

    await expect
      .poll(() => offCentre(root.getByRole('listbox', { name: 'Hours' }), '[aria-selected="true"]'))
      .toBeLessThanOrEqual(2);
    await expect
      .poll(() => offCentre(root.getByRole('listbox', { name: 'Minutes' }), '[aria-selected="true"]'))
      .toBeLessThanOrEqual(2);
  });

  test('the range story marks both ends and bands the options between them, per active side', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const hours = root.getByRole('listbox', { name: 'Hours' });
    const minutes = root.getByRole('listbox', { name: 'Minutes' });

    expect(await optionsWith(hours, 'data-range-start')).toEqual(['09']);
    expect(await optionsWith(hours, 'data-range-end')).toEqual(['17']);
    expect(await optionsWith(minutes, 'data-range-end')).toEqual(['30']);
    expect(await optionsWith(hours, 'data-band')).toEqual(['09', '10', '11', '12', '13', '14', '15', '16', '17']);
    expect(await optionsWith(minutes, 'data-band')).toHaveLength(12);

    const banded = hours.locator('[data-band]').first();
    const outside = hours.getByText('08', { exact: true });
    const bandPaint = (option: Locator) => option.evaluate((el) => getComputedStyle(el, '::before').display);

    expect(await bandPaint(banded)).not.toBe('none');
    expect(await bandPaint(outside)).toBe('none');

    await root.getByRole('button', { name: /End time/ }).click();

    await expect.poll(() => optionsWith(minutes, 'data-band')).toEqual(['00', '05', '10', '15', '20', '25', '30']);
    expect(await optionsWith(hours, 'data-band')).toEqual(['09', '10', '11', '12', '13', '14', '15', '16', '17']);
  });
});

test.describe('time-picker / keyboard layout', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('arrow navigation keeps the focused option centred in its column', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const hours = root.getByRole('listbox', { name: 'Hours' });

    await pressKey(page, 'Tab');
    await pressKeys(page, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);

    await expect.poll(() => offCentre(hours, FOCUSED_OPTION)).toBeLessThanOrEqual(2);

    await pressKey(page, 'End');

    await expect(hours.getByText('23', { exact: true })).toBeFocused();
    await expect.poll(() => offCentre(hours, FOCUSED_OPTION)).toBeLessThanOrEqual(2);
  });

  test('ArrowLeft moves to the next column and ArrowRight back when the picker reads right-to-left', async ({
    page,
  }) => {
    const root = await openStory(page, WITH_SECONDS_STORY_ID);
    const hour = root.getByRole('listbox', { name: 'Hours' }).locator(FOCUSED_OPTION);
    const minute = root.getByRole('listbox', { name: 'Minutes' }).locator(FOCUSED_OPTION);

    await root.locator('.et-time-picker').evaluate((el) => el.setAttribute('dir', 'rtl'));

    await pressKey(page, 'Tab');
    await expect(hour).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(hour).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(minute).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(hour).toBeFocused();
  });

  test('a column scrollbar stays hidden at rest and shows while the pointer is over its column', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const minutesScrollbar = columnScrollbar(root, 1);

    await page.mouse.move(0, 0);
    await expect(columnScrollbar(root, 0)).not.toHaveClass(SCROLLBAR_VISIBLE, { timeout: 3_000 });
    await expect(minutesScrollbar).not.toHaveClass(SCROLLBAR_VISIBLE, { timeout: 3_000 });

    await root.getByRole('listbox', { name: 'Minutes' }).hover();

    await expect(minutesScrollbar).toHaveClass(SCROLLBAR_VISIBLE);
    await expect(columnScrollbar(root, 0)).not.toHaveClass(SCROLLBAR_VISIBLE);

    await page.mouse.move(0, 0);

    await expect(minutesScrollbar).not.toHaveClass(SCROLLBAR_VISIBLE, { timeout: 3_000 });
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

  test('a swipe scrolls a column natively without changing the selection', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-13T09:30:00+02:00'));
    const root = await openStory(page, DEFAULT_STORY_ID);
    const minutes = root.getByRole('listbox', { name: 'Minutes' });
    const selectedBefore = await minutes.locator('[aria-selected="true"]').allInnerTexts();
    const scrollBefore = await minutes.evaluate((el) => el.scrollTop);
    const box = await boxOf(minutes);
    const x = box.x + box.width / 2;

    await touchSwipe(page, { x, y: box.y + box.height * 0.8 }, { x, y: box.y + box.height * 0.2 });

    await expect.poll(() => minutes.evaluate((el) => el.scrollTop)).toBeGreaterThan(scrollBefore + 40);
    await expect(minutes.locator('[aria-selected="true"]')).toHaveText(selectedBefore);
    await expect(columnScrollbar(root, 1)).toHaveClass(SCROLLBAR_VISIBLE);
  });
});
