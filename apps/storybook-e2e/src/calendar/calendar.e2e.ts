import { Locator, Page, expect, test } from '@playwright/test';
import { openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-date-time-calendar--default';
const RANGE_STORY_ID = 'components-date-time-calendar--range';
const DISABLED_DATES_STORY_ID = 'components-date-time-calendar--disabled-dates';
const MONTH_VIEW_STORY_ID = 'components-date-time-calendar--month-view';

const FOCUSED_CELL = ".et-calendar-weeks:not(.et-calendar-weeks--leave) .et-calendar-cell[tabindex='0']";
const FOCUSED_COARSE_CELL = ".et-calendar-weeks:not(.et-calendar-weeks--leave) .et-calendar-cell--coarse[tabindex='0']";
const HEADER_LABEL_VALUE = '.et-calendar-header-label-value:not(.et-calendar-header-label-value--leave)';

/** The cell draws its ring on the nested `.et-calendar-cell-content`, so `expectFocusVisible` does not apply. */
async function expectCellFocusVisible(cell: Locator): Promise<void> {
  await expect(cell).toBeFocused();

  const state = await cell.evaluate((el) => {
    const content = el.querySelector('.et-calendar-cell-content');
    const style = content ? getComputedStyle(content) : null;

    return {
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: style?.outlineStyle ?? 'none',
    };
  });

  expect(state.matchesFocusVisible).toBe(true);
  expect(state.outlineStyle).not.toBe('none');
}

/** The number of enabled header buttons before the grid varies per story, so tab until `target` has focus. */
async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await pressKey(page, 'Tab');

    if (await target.evaluate((el) => el === document.activeElement)) {
      return;
    }
  }

  throw new Error('Tab never reached the target element');
}

test.describe('calendar / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the day grid as one stop and the focus ring is visible on the focused day', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const focused = root.locator(FOCUSED_CELL);

    await tabUntilFocused(page, focused);

    await expect(focused).toHaveCount(1);
    await expectCellFocusVisible(focused);
  });
});

test.describe('calendar / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('ArrowRight and ArrowLeft move focus by one day', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);
    const content = focused.locator('.et-calendar-cell-content');

    await tabUntilFocused(page, focused);
    await expect(content).toHaveText('1');

    await pressKey(page, 'ArrowRight');
    await expect(content).toHaveText('2');
    await expect(focused).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(content).toHaveText('1');
    await expect(focused).toBeFocused();
  });

  test('ArrowUp and ArrowDown move focus by one week', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);
    const content = focused.locator('.et-calendar-cell-content');

    await tabUntilFocused(page, focused);
    await expect(content).toHaveText('1');

    await pressKey(page, 'ArrowDown');
    await expect(content).toHaveText('8');
    await expect(focused).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(content).toHaveText('1');
    await expect(focused).toBeFocused();
  });

  test('Home and End move focus to the start and end of the focused week', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);

    await tabUntilFocused(page, focused);

    await pressKey(page, 'Home');
    await expect(focused).toHaveAttribute('aria-label', /^Monday/);
    await expect(focused).toBeFocused();

    await pressKey(page, 'End');
    await expect(focused).toHaveAttribute('aria-label', /^Sunday/);
    await expect(focused).toBeFocused();
  });

  test('PageUp and PageDown change the month and the header label follows', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);
    const header = root.locator(HEADER_LABEL_VALUE).first();

    await tabUntilFocused(page, focused);
    const initialLabel = await header.textContent();

    await pressKey(page, 'PageUp', 200);
    await expect(header).not.toHaveText(initialLabel ?? '');

    await pressKey(page, 'PageDown', 200);
    await expect(header).toHaveText(initialLabel ?? '');
    await expect(focused.locator('.et-calendar-cell-content')).toHaveText('1');
  });

  test('Shift+PageUp and Shift+PageDown change the year and the header label follows', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);
    const header = root.locator(HEADER_LABEL_VALUE).first();

    await tabUntilFocused(page, focused);
    const initialLabel = await header.textContent();

    await pressKey(page, 'Shift+PageUp', 200);
    await expect(header).not.toHaveText(initialLabel ?? '');

    await pressKey(page, 'Shift+PageDown', 200);
    await expect(header).toHaveText(initialLabel ?? '');
  });

  test('Enter and Space select the focused day, and aria-selected follows the single selection', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);

    await tabUntilFocused(page, focused);
    const firstDayLabel = await focused.getAttribute('aria-label');

    await pressKey(page, 'Enter');
    await expect(focused).toHaveAttribute('aria-selected', 'true');
    await expect(focused).toHaveAttribute('data-selected', '');

    await pressKey(page, 'ArrowRight');
    await expect(focused).toBeFocused();
    await pressKey(page, ' ');

    await expect(focused).toHaveAttribute('aria-selected', 'true');
    await expect(root.locator(`.et-calendar-cell[aria-label="${firstDayLabel}"]`)).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  test('a disabled date stays focusable but Enter does not select it', async ({ page }) => {
    const root = await openStory(page, DISABLED_DATES_STORY_ID);
    const focused = root.locator(FOCUSED_CELL);

    await tabUntilFocused(page, focused);

    for (let i = 0; i < 6 && (await focused.getAttribute('aria-disabled')) !== 'true'; i++) {
      await pressKey(page, 'ArrowRight');
    }

    await expect(focused).toHaveAttribute('aria-disabled', 'true');
    await expect(focused).toHaveAttribute('tabindex', '0');
    await expect(focused).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(focused).toHaveAttribute('aria-selected', 'false');
    await expect(focused).not.toHaveAttribute('data-selected', '');
    await expect(root.getByText('Value: null')).toBeVisible();
  });

  test('two selections in the range story form a range', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);

    await tabUntilFocused(page, focused);
    const startLabel = await focused.getAttribute('aria-label');
    await pressKey(page, 'Enter');

    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');
    const midLabel = await focused.getAttribute('aria-label');
    await expect(focused).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');
    const endLabel = await focused.getAttribute('aria-label');
    await pressKey(page, 'Enter');

    await expect(root.locator(`.et-calendar-cell[aria-label="${startLabel}"]`)).toHaveAttribute('data-range-start', '');
    await expect(root.locator(`.et-calendar-cell[aria-label="${endLabel}"]`)).toHaveAttribute('data-range-end', '');
    await expect(root.locator(`.et-calendar-cell[aria-label="${midLabel}"]`)).toHaveAttribute('data-in-range', '');
  });

  test('arrows move the focused cell by one month in the month grid', async ({ page }) => {
    const root = await openStory(page, MONTH_VIEW_STORY_ID);
    const focused = root.locator(FOCUSED_COARSE_CELL);

    await tabUntilFocused(page, focused);
    await expect(focused).toHaveCount(1);
    const startLabel = await focused.getAttribute('aria-label');

    await pressKey(page, 'ArrowRight', 200);
    await expect(focused).not.toHaveAttribute('aria-label', startLabel ?? '');
    await expect(focused).toBeFocused();

    await pressKey(page, 'ArrowLeft', 200);
    await expect(focused).toHaveAttribute('aria-label', startLabel ?? '');
    await expect(focused).toBeFocused();
  });
});

test.describe('calendar / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap selects a day', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const cell = root.locator(FOCUSED_CELL);

    await tap(cell);

    await expect(cell).toHaveAttribute('aria-selected', 'true');
  });

  test('a tap on the next-month button changes the month', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const header = root.locator(HEADER_LABEL_VALUE).first();
    const initialLabel = await header.textContent();
    const nextButton = root.locator('.et-calendar-nav-button--next');

    await tap(nextButton);

    await expect.poll(() => header.textContent()).not.toBe(initialLabel);
  });
});
