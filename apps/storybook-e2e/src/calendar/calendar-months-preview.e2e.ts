import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, tabUntilFocused } from '../support';

const DEFAULT_STORY_ID = 'components-date-time-calendar--default';
const RANGE_STORY_ID = 'components-date-time-calendar--range';
const TWO_MONTHS_STORY_ID = 'components-date-time-calendar--two-months';

const LIVE_WEEKS = '.et-calendar-weeks:not(.et-calendar-weeks--leave)';
const FOCUSED_CELL = `${LIVE_WEEKS} .et-calendar-cell[tabindex='0']`;
const DAY_BUTTONS = `${LIVE_WEEKS} button.et-calendar-cell`;
const HEADER_LABEL_VALUE = '.et-calendar-header-label-value:not(.et-calendar-header-label-value--leave)';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const focusedLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');

const monthOfLabel = (label: string) => MONTH_NAMES.findIndex((month) => label.includes(month));

const dayOfLabel = (label: string) => Number(label.match(/ (\d+)(st|nd|rd|th),/)?.[1]);

async function expectCellFocusVisible(cell: Locator) {
  await expect(cell).toBeFocused();
  expect(await cell.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  await expect(cell.locator('.et-calendar-cell-content')).not.toHaveCSS('outline-style', 'none');
}

async function expectOneLiveGrid(root: Locator) {
  await expect(root.locator('.et-calendar-weeks')).toHaveCount(1);
}

test.describe('calendar / focus across re-render', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('PageDown keeps focus on the same day of the next month once the old grid has left', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);

    await tabUntilFocused(page, focused);
    const before = await focusedLabel(page);

    await pressKey(page, 'PageDown');
    await expectOneLiveGrid(root);

    const after = await focusedLabel(page);

    expect(monthOfLabel(after)).toBe((monthOfLabel(before) + 1) % 12);
    expect(dayOfLabel(after)).toBe(dayOfLabel(before));
    await expectCellFocusVisible(focused);
  });

  test('ArrowUp off the first week navigates back a month and focuses the day a week earlier', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);
    const header = root.locator(HEADER_LABEL_VALUE).first();

    await tabUntilFocused(page, focused);
    const headerBefore = await header.textContent();

    await pressKey(page, 'ArrowUp');

    await expect(header).not.toHaveText(headerBefore ?? '');
    await expectOneLiveGrid(root);
    await expect(focused).toBeFocused();
    expect(dayOfLabel(await focusedLabel(page))).toBeGreaterThanOrEqual(24);
  });

  test('PageDown pressed three times in a row, mid-transition, lands three months on with focus kept', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { startAtMonthOffset: 1 } });
    const focused = root.locator(FOCUSED_CELL);

    await tabUntilFocused(page, focused);
    const before = await focusedLabel(page);

    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');

    await expectOneLiveGrid(root);
    expect(monthOfLabel(await focusedLabel(page))).toBe((monthOfLabel(before) + 3) % 12);
    await expectCellFocusVisible(focused);
  });

  test('the next-month button keeps focus on itself while the grid re-renders', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const next = root.getByRole('button', { name: 'Next month' });

    await tabUntilFocused(page, next);
    await pressKey(page, 'Enter');
    await pressKey(page, 'Enter');

    await expectOneLiveGrid(root);
    await expectFocusVisible(next);
  });
});

test.describe('calendar / range hover preview', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('an untouched range calendar bands nothing', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);

    await expect(root.locator('.et-calendar-cell[data-preview]')).toHaveCount(0);
  });

  test('after the first pick, hovering a later day previews the band and it follows the pointer', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const days = root.locator(DAY_BUTTONS);

    await days.nth(10).click();
    await days.nth(15).hover();

    await expect(root.locator('.et-calendar-cell[data-preview]')).not.toHaveCount(0);
    await expect(days.nth(12)).toHaveAttribute('data-band', 'middle');
    await expect(days.nth(14)).toHaveAttribute('data-preview', '');

    await days.nth(12).hover();

    await expect(days.nth(14)).not.toHaveAttribute('data-preview');
    await expect(days.nth(11)).toHaveAttribute('data-preview', '');
  });

  test('moving keyboard focus previews the band like hovering does', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const days = root.locator(DAY_BUTTONS);

    await days.nth(10).click();
    await page.mouse.move(0, 0);
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');

    await expect(days.nth(11)).toHaveAttribute('data-preview', '');
    await expect(days.nth(12)).toHaveAttribute('data-preview', '');
    await expect(days.nth(13)).toHaveAttribute('data-preview', '');
    await expect(days.nth(14)).not.toHaveAttribute('data-preview');
  });

  test('the second pick turns the preview into the selected range', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const days = root.locator(DAY_BUTTONS);

    await days.nth(10).click();
    await days.nth(13).hover();
    await days.nth(13).click();
    await page.mouse.move(0, 0);

    await expect(days.nth(10)).toHaveAttribute('aria-selected', 'true');
    await expect(days.nth(13)).toHaveAttribute('aria-selected', 'true');
    await expect(days.nth(12)).toHaveAttribute('data-band', 'middle');
    await expect(root.locator('.et-calendar-cell[data-preview]')).toHaveCount(0);
  });
});

test.describe('calendar / several months', () => {
  test('two months sit side by side in one row', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const root = await openStory(page, TWO_MONTHS_STORY_ID);
    const months = root.locator(`${LIVE_WEEKS} .et-calendar-month`);

    await expect(months).toHaveCount(2);

    const first = await boxOf(months.nth(0));
    const second = await boxOf(months.nth(1));

    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
  });

  test('each month owns only its own days, so no date appears twice', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const root = await openStory(page, TWO_MONTHS_STORY_ID);
    const labels = await root.locator(DAY_BUTTONS).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));

    expect(new Set(labels).size).toBe(labels.length);
    expect(dayOfLabel(labels[0] ?? '')).toBe(1);
  });
});

test.describe('calendar / several months keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('ArrowRight from the last day of the first month moves into the second without navigating', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const root = await openStory(page, TWO_MONTHS_STORY_ID);
    const header = root.locator(HEADER_LABEL_VALUE).first();
    const firstMonthDays = root.locator(`${LIVE_WEEKS} .et-calendar-month`).first().locator('button.et-calendar-cell');
    const headerBefore = await header.textContent();

    await firstMonthDays.last().click();
    await pressKey(page, 'ArrowRight');

    const focused = await focusedLabel(page);

    expect(dayOfLabel(focused)).toBe(1);
    await expect(header).toHaveText(headerBefore ?? '');
    await expect(root.locator(`${LIVE_WEEKS} .et-calendar-month`).nth(1).locator(':focus')).toHaveCount(1);
  });
});
