import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, pressKeys, touchDrag } from '../support';

const DEFAULT_ID = 'components-date-time-scheduler--default';
const WEEK_ID = 'components-date-time-scheduler--week';
const DAY_ID = 'components-date-time-scheduler--day';
const AGENDA_ID = 'components-date-time-scheduler--agenda';
const NARROW_ID = 'components-date-time-scheduler--narrow';
const WITHOUT_DRAG_ID = 'components-date-time-scheduler--without-appointment-drag';
const BUSINESS_HOURS_ID = 'components-date-time-scheduler--business-hours';
const WITHOUT_NOW_INDICATOR_ID = 'components-date-time-scheduler--without-now-indicator';

/** 10:30 wall time in the browser's `timezoneId` (Europe/Berlin, CEST in July), whatever zone the runner is in. */
const FIXED_NOW = new Date('2026-07-15T10:30:00+02:00');

const DIALOG_ROOT = '[role="dialog"]';

/** The edit surface ignores Escape until its enter transition has started. */
async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator('.et-overlay')).toHaveClass(/et-animation-enter-done/);
}

async function shadeCountsPerDay(root: Locator): Promise<number[]> {
  return root
    .locator('.et-scheduler-time-grid-day')
    .evaluateAll((days) => days.map((day) => day.querySelectorAll('.et-scheduler-time-grid-non-business').length));
}

test.describe('scheduler / business hours', () => {
  test('shades the closed stretches of every weekday and the whole of a closed day', async ({ page }) => {
    const root = await openStory(page, BUSINESS_HOURS_ID);

    await expect(root.locator('.et-scheduler-time-grid-day')).toHaveCount(7);

    const counts = await shadeCountsPerDay(root);

    expect([...counts].sort()).toEqual([1, 1, 2, 3, 3, 3, 3]);
  });

  test('a closed day is shaded over its full height, a weekday up to its opening hour', async ({ page }) => {
    const root = await openStory(page, BUSINESS_HOURS_ID);
    const counts = await shadeCountsPerDay(root);
    const days = root.locator('.et-scheduler-time-grid-day');
    const closedDay = days.nth(counts.indexOf(1));
    const weekday = days.nth(counts.indexOf(3));

    const hourRow = await boxOf(weekday.locator('.et-scheduler-time-grid-hour-row').first());
    const closedColumn = await boxOf(closedDay);
    const closedShade = await boxOf(closedDay.locator('.et-scheduler-time-grid-non-business'));
    const morningShade = await boxOf(weekday.locator('.et-scheduler-time-grid-non-business').first());

    expect(closedShade.height).toBeCloseTo(closedColumn.height, 0);
    expect(morningShade.height).toBeCloseTo(hourRow.height * 8, 0);
    await expect(closedDay.locator('.et-scheduler-time-grid-non-business')).not.toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
  });
});

test.describe('scheduler / business hours drag', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('dragging across a closed stretch still draws a new range', async ({ page }) => {
    const root = await openStory(page, BUSINESS_HOURS_ID);
    const counts = await shadeCountsPerDay(root);
    const closedDay = root.locator('.et-scheduler-time-grid-day').nth(counts.indexOf(1));

    await closedDay.scrollIntoViewIfNeeded();
    const box = await boxOf(root.locator('.et-scheduler-time-grid-body'));
    const column = await boxOf(closedDay);
    const x = column.x + column.width / 2;
    const y = box.y + 40;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 120, { steps: 10 });

    await expect(closedDay.locator('.et-scheduler-time-grid-draft')).toBeVisible();

    await page.mouse.up();
  });
});

async function hourOfNowLine(root: Locator): Promise<number> {
  const column = await boxOf(root.locator('.et-scheduler-time-grid-day'));
  const line = await boxOf(root.locator('.et-scheduler-time-grid-now'));

  return ((line.y - column.y) / column.height) * 24;
}

test.describe('scheduler / now line', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: FIXED_NOW });
  });

  test('marks the current time on today and moves with the clock', async ({ page }) => {
    const root = await openStory(page, DAY_ID);

    await expect(root.locator('.et-scheduler-time-grid-now')).toHaveCount(1);
    expect(await hourOfNowLine(root)).toBeCloseTo(10.5, 1);

    await page.clock.runFor(30 * 60_000);

    await expect.poll(() => hourOfNowLine(root)).toBeCloseTo(11, 1);
  });

  test('draws no line with the now indicator off', async ({ page }) => {
    const root = await openStory(page, WITHOUT_NOW_INDICATOR_ID);

    await expect(root.locator('.et-scheduler-time-grid-day')).toHaveCount(1);
    await expect(root.locator('.et-scheduler-time-grid-now')).toHaveCount(0);
  });
});

test.describe('scheduler / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the Today button first with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const today = root.getByRole('button', { name: 'Today' });

    await pressKey(page, 'Tab');

    await expectFocusVisible(today);
  });

  test('Tab walks Today, Add appointment, Previous, Next, then the checked view switch', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');
    await expectFocusVisible(root.getByRole('button', { name: 'Today' }));

    await pressKey(page, 'Tab');
    await expectFocusVisible(root.getByRole('button', { name: 'Add appointment' }));

    await pressKey(page, 'Tab');
    await expectFocusVisible(root.getByRole('button', { name: 'Previous' }));

    await pressKey(page, 'Tab');
    await expectFocusVisible(root.getByRole('button', { name: 'Next' }));

    await pressKey(page, 'Tab');
    const month = root.getByRole('radio', { name: 'Month' });
    await expectFocusVisible(month);
    await expect(month).toHaveAttribute('aria-checked', 'true');
  });

  test('Tab moves on from the view switch into the grid as a single stop with a visible focus ring', async ({
    page,
  }) => {
    await openStory(page, WEEK_ID);

    await pressKeys(
      page,
      Array.from({ length: 6 }, () => 'Tab'),
    );

    const focused = page.locator(':focus');
    await expectFocusVisible(focused);
    await expect(focused).toHaveAttribute('role', 'gridcell');

    await pressKey(page, 'Tab');
    await expect(page.locator('et-scheduler-time-grid-view :focus')).toHaveCount(0);
  });
});

test.describe('scheduler / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard model');

  test('ArrowRight on the view switch steps Month, Week, Day, Agenda and wraps back to Month', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await expect(root.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    await expect(root.locator('.et-scheduler-time-grid-view')).toBeVisible();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('radio', { name: 'Agenda' })).toHaveAttribute('aria-checked', 'true');
    await expect(root.locator('.et-scheduler-agenda-view')).toBeVisible();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true');
    await expect(root.locator('.et-scheduler-month-view')).toBeVisible();
  });

  test('the day view renders a single day column', async ({ page }) => {
    const root = await openStory(page, DAY_ID);

    await expect(root.locator('.et-scheduler-time-grid-header-day')).toHaveCount(1);
  });

  test('Enter on a focused appointment opens the edit surface for it', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const standup = root.getByRole('button', { name: 'Daily standup' });

    await standup.focus();
    await pressKey(page, 'Enter');

    await expect(page.locator(DIALOG_ROOT)).toBeVisible({ timeout: 8_000 });
  });

  test('Space on a focused appointment opens the edit surface for it', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const call = root.getByRole('button', { name: 'Client call: Acme' });

    await call.focus();
    await pressKey(page, 'Space');

    await expect(page.locator(DIALOG_ROOT)).toBeVisible({ timeout: 8_000 });
  });

  test('Escape closes the edit surface and returns focus to the appointment that opened it', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const standup = root.getByRole('button', { name: 'Daily standup' });

    await standup.click({ timeout: 8_000 });
    await waitForEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
    await expect(standup).toBeFocused();
  });

  test('Tab from Cancel reaches Save, and Shift+Tab from Save returns to Cancel', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    await root.getByRole('button', { name: 'Daily standup' }).click({ timeout: 8_000 });

    const dialog = page.locator(DIALOG_ROOT);
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const save = dialog.getByRole('button', { name: 'Save' });

    await cancel.focus();
    await pressKey(page, 'Tab');
    await expect(save).toBeFocused();

    await pressKey(page, 'Shift+Tab');
    await expect(cancel).toBeFocused();
  });
});

/** Tabs from the top of the story past the toolbar onto the grid's one tab stop. */
async function tabIntoGrid(page: Page): Promise<Locator> {
  await pressKeys(
    page,
    Array.from({ length: 6 }, () => 'Tab'),
  );

  const cell = page.locator('[role="gridcell"][tabindex="0"]');
  await expectFocusVisible(cell);

  return cell;
}

test.describe('scheduler / grid keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard model');

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: FIXED_NOW });
  });

  test('the month grid starts on today and moves by day and week with the focus ring along', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const cell = await tabIntoGrid(page);

    await expect(cell).toContainText('Wednesday, July 15th, 2026');

    await pressKey(page, 'ArrowRight');
    await expectFocusVisible(root.locator('[role="gridcell"]', { hasText: 'Thursday, July 16th, 2026' }));

    await pressKey(page, 'ArrowDown');
    await expectFocusVisible(root.locator('[role="gridcell"]', { hasText: 'Thursday, July 23rd, 2026' }));
    await expect(root.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);
  });

  test('PageDown pages the month grid and keeps the focus on the same day', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    await tabIntoGrid(page);

    await pressKey(page, 'PageDown');

    await expect(root.locator('.et-scheduler-header-label')).toHaveText('August 2026');
    await expectFocusVisible(root.locator('[role="gridcell"]', { hasText: 'Saturday, August 15th, 2026' }));
  });

  test('Enter walks into the day appointments, arrows move between them, Escape returns', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const cell = await tabIntoGrid(page);
    const appointments = cell.locator('.et-scheduler-appointment');

    await pressKey(page, 'Enter');
    await expectFocusVisible(appointments.nth(0));

    await pressKey(page, 'ArrowDown');
    await expectFocusVisible(appointments.nth(1));

    await pressKey(page, 'Escape');
    await expectFocusVisible(cell);
    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);

    await pressKey(page, 'Enter');
    await pressKey(page, 'Enter');
    await expect(page.locator(DIALOG_ROOT)).toBeVisible({ timeout: 8_000 });
    await expect(root.locator('.et-scheduler-appointment[data-selected]')).toHaveCount(1);
  });

  test('Enter on an empty month day opens the create surface', async ({ page }) => {
    await openStory(page, DEFAULT_ID);
    await tabIntoGrid(page);

    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'Enter');

    await expect(page.locator(DIALOG_ROOT)).toBeVisible({ timeout: 8_000 });
  });

  test('the time grid moves by slot, climbs into the all-day row, and pages by week', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const header = root.locator('.et-scheduler-header-label');
    const cell = await tabIntoGrid(page);

    await expect(cell).toHaveAttribute('aria-label', /^Wednesday, July 15th, 2026, \d\d:00$/);

    await pressKeys(
      page,
      Array.from({ length: 25 }, () => 'ArrowUp'),
    );
    await expectFocusVisible(root.getByRole('gridcell', { name: 'Wednesday, July 15th, 2026, All day' }));

    await pressKey(page, 'ArrowDown');
    await expectFocusVisible(root.getByRole('gridcell', { name: 'Wednesday, July 15th, 2026, 00:00' }));

    await pressKey(page, 'ArrowRight');
    await expectFocusVisible(root.getByRole('gridcell', { name: 'Thursday, July 16th, 2026, 00:00' }));

    const before = await header.textContent();
    await pressKey(page, 'PageDown');

    await expect(header).not.toHaveText(before ?? '');
    await expectFocusVisible(root.getByRole('gridcell', { name: 'Thursday, July 23rd, 2026, 00:00' }));
  });

  test('Space on a time slot opens the create surface', async ({ page }) => {
    await openStory(page, WEEK_ID);
    await tabIntoGrid(page);

    await pressKey(page, 'Space');

    await expect(page.locator(DIALOG_ROOT)).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('scheduler / drag', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('dragging an appointment down the day column reschedules it to a later time', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const block = root.locator('.et-scheduler-time-grid-block[title="Daily standup"]');

    await block.scrollIntoViewIfNeeded();
    const before = await block.locator('.et-scheduler-appointment-time-range').textContent();

    const box = await boxOf(block);

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 150, { steps: 10 });
    await page.mouse.up();

    const timeRange = block.locator('.et-scheduler-appointment-time-range');
    await expect(timeRange).not.toHaveText(before ?? '');
    await expect(block).not.toHaveAttribute('data-dragging', '');
  });

  test('the without-appointment-drag story does not move an appointment on the same drag', async ({ page }) => {
    const root = await openStory(page, WITHOUT_DRAG_ID);
    const block = root.locator('.et-scheduler-time-grid-block[title="Daily standup"]');

    await block.scrollIntoViewIfNeeded();
    const before = await block.locator('.et-scheduler-appointment-time-range').textContent();

    const box = await boxOf(block);

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 150, { steps: 10 });
    await page.mouse.up();

    await expect(block.locator('.et-scheduler-appointment-time-range')).toHaveText(before ?? '');
  });

  test('the without-appointment-drag story renders no resize handles', async ({ page }) => {
    const root = await openStory(page, WITHOUT_DRAG_ID);
    const block = root.locator('.et-scheduler-time-grid-block[title="Daily standup"]');

    await expect(block.locator('.et-scheduler-time-grid-block-resize')).toHaveCount(0);
    await expect(block).not.toHaveAttribute('data-draggable', '');
  });
});

test.describe('scheduler / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap and touch drag');

  test('the narrow story renders the icon-only Today button', async ({ page }) => {
    const root = await openStory(page, NARROW_ID);
    const today = root.getByRole('button', { name: 'Today' });

    await expect(today).toBeVisible();
    await expect(root.locator('.et-scheduler-today-button-label')).toBeHidden();
  });

  test('a tap on an appointment opens the full-screen edit surface', async ({ page }) => {
    const root = await openStory(page, AGENDA_ID);
    const standup = root.getByRole('button', { name: 'Daily standup' });

    await standup.tap({ timeout: 8_000 });

    await expect(page.locator(DIALOG_ROOT)).toBeVisible({ timeout: 3_000 });
  });

  test('a long-press-then-drag on an appointment reschedules it', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const call = root.locator('.et-scheduler-time-grid-block[title="Daily standup"]');

    await call.scrollIntoViewIfNeeded();
    const before = await call.locator('.et-scheduler-appointment-time-range').textContent();

    const box = await boxOf(call);

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await touchDrag(page, { x, y }, { x, y: y + 150 }, { holdMs: 450 });

    const timeRange = call.locator('.et-scheduler-appointment-time-range');
    await expect(timeRange).not.toHaveText(before ?? '');
  });

  test('a quick swipe across the week view steps to the next period instead of dragging', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const header = root.locator('.et-scheduler-header-label');
    const before = await header.textContent();

    const body = root.locator('.et-scheduler-time-grid-body');
    const box = await boxOf(body);

    const y = box.y + box.height / 2;

    await touchDrag(page, { x: box.x + 300, y }, { x: box.x + 40, y });

    await expect(header).not.toHaveText(before ?? '', { timeout: 5_000 });
  });
});
