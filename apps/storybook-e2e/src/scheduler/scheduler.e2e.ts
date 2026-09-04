import { Page, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, touchDrag } from '../support';

const DEFAULT_ID = 'components-date-time-scheduler--default';
const WEEK_ID = 'components-date-time-scheduler--week';
const DAY_ID = 'components-date-time-scheduler--day';
const AGENDA_ID = 'components-date-time-scheduler--agenda';
const NARROW_ID = 'components-date-time-scheduler--narrow';
const WITHOUT_DRAG_ID = 'components-date-time-scheduler--without-appointment-drag';

const DIALOG_ROOT = '[role="dialog"]';

/** The edit surface ignores Escape until its enter transition has started. */
async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator('.et-overlay')).toHaveClass(/et-animation-enter-done/);
}

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

  test('Tab moves on from the view switch into an appointment badge with a visible focus ring', async ({ page }) => {
    await openStory(page, WEEK_ID);

    for (let i = 0; i < 6; i++) {
      await pressKey(page, 'Tab');
    }

    const focused = page.locator(':focus');
    await expectFocusVisible(focused);
    await expect(focused).toHaveAttribute('type', 'button');
    await expect(focused).toHaveAttribute('title', /.+/);
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

test.describe('scheduler / drag', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('dragging an appointment down the day column reschedules it to a later time', async ({ page }) => {
    const root = await openStory(page, WEEK_ID);
    const block = root.locator('.et-scheduler-time-grid-block[title="Daily standup"]');

    await block.scrollIntoViewIfNeeded();
    const before = await block.locator('.et-scheduler-appointment-time-range').textContent();

    const box = await block.boundingBox();
    if (!box) throw new Error('appointment block has no bounding box');

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

    const box = await block.boundingBox();
    if (!box) throw new Error('appointment block has no bounding box');

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

    const box = await call.boundingBox();
    if (!box) throw new Error('appointment block has no bounding box');

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
    const box = await body.boundingBox();
    if (!box) throw new Error('time grid body has no bounding box');

    const y = box.y + box.height / 2;

    await touchDrag(page, { x: box.x + 300, y }, { x: box.x + 40, y });

    await expect(header).not.toHaveText(before ?? '', { timeout: 5_000 });
  });
});
