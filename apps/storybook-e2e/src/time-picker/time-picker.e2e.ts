import { Locator, expect, test } from '@playwright/test';
import {
  TouchPoint,
  boxOf,
  clickRing,
  expectFocusVisible,
  expectTouchMode,
  mouseDownAlongRing,
  openStory,
  pressKey,
  pressKeys,
  ringPoint,
  tapRing,
  touchDragAlongRing,
} from '../support';

const DEFAULT_STORY_ID = 'components-date-time-time-picker--default';
const WITH_VALUE_STORY_ID = 'components-date-time-time-picker--with-value';
const OPENING_HOURS_STORY_ID = 'components-date-time-time-picker--opening-hours';
const RANGE_STORY_ID = 'components-date-time-time-picker--range';
const RANGE_HAND_OFF_STORY_ID = 'components-date-time-time-picker--range-hand-off';

const RING = '.et-time-picker-ring';

async function ringCentre(ring: Locator): Promise<TouchPoint> {
  const box = await boxOf(ring);

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function expectNoFocusRing(handle: Locator): Promise<void> {
  await expect(handle).toBeFocused();
  await expect(handle).toHaveCSS('outline-style', 'none');
}

test.describe('time-picker / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the handle and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await pressKey(page, 'Tab');

    await expectFocusVisible(handle);
  });

  test('Tab moves from the start handle to the end handle, and focus makes its end the active one', async ({
    page,
  }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const start = root.getByRole('slider', { name: 'Start time' });
    const end = root.getByRole('slider', { name: 'End time' });

    await pressKey(page, 'Tab');
    await expectFocusVisible(start);
    await expect(start).toHaveAttribute('data-active', 'true');

    await pressKey(page, 'Tab');
    await expectFocusVisible(end);
    await expect(end).toHaveAttribute('data-active', 'true');
    await expect(start).not.toHaveAttribute('data-active');
  });

  test('a press on the ring focuses the handle without a focus ring, and a key press brings the ring back', async ({
    page,
  }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await clickRing(page, root.locator(RING), 18 * 60);

    await expectNoFocusRing(handle);
    await expect(handle).toHaveAttribute('data-pointer-focused', 'true');

    await pressKey(page, 'ArrowRight');

    await expectFocusVisible(handle);
    await expect(handle).not.toHaveAttribute('data-pointer-focused');
  });

  test('Tab reaches the handle of an empty picker', async ({ page }) => {
    test.fail(true, 'defect: an empty handle is display: none, so no key can set the first time');
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    await expect(root.getByRole('slider', { name: 'Time' })).toBeFocused({ timeout: 1_000 });
  });
});

test.describe('time-picker / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('the arrows move one minute step, PageUp and PageDown one hour', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await pressKey(page, 'Tab');
    await expect(handle).toHaveAttribute('aria-valuenow', '870');
    await expect(handle).toHaveAttribute('aria-valuetext', '14:30');

    await pressKey(page, 'ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '885');

    await pressKey(page, 'ArrowUp');
    await expect(handle).toHaveAttribute('aria-valuenow', '900');

    await pressKeys(page, ['ArrowLeft', 'ArrowDown', 'ArrowDown']);
    await expect(handle).toHaveAttribute('aria-valuenow', '855');

    await pressKey(page, 'PageUp');
    await expect(handle).toHaveAttribute('aria-valuenow', '915');

    await pressKey(page, 'PageDown');
    await expect(handle).toHaveAttribute('aria-valuenow', '855');
    await expect(handle).toHaveAttribute('aria-valuetext', '14:15');
    await expect(root.getByText(/^Value: 14:15:00/)).toBeVisible();
  });

  test('Home and End go to the first and last time, and an arrow wraps past midnight', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await pressKey(page, 'Tab');

    await pressKey(page, 'Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '0');

    await pressKey(page, 'End');
    await expect(handle).toHaveAttribute('aria-valuenow', '1425');

    await pressKey(page, 'ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '0');
  });

  test('a modified arrow leaves the time alone', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await pressKey(page, 'Tab');
    await pressKeys(page, ['Control+ArrowRight', 'Alt+ArrowRight', 'Meta+ArrowRight']);

    await expect(handle).toHaveAttribute('aria-valuenow', '870');
  });

  test('a bounded picker keeps Home and End inside its bounds, and the keys skip a blocked span', async ({ page }) => {
    const root = await openStory(page, OPENING_HOURS_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await pressKey(page, 'Tab');

    await pressKey(page, 'Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '480');

    await pressKey(page, 'End');
    await expect(handle).toHaveAttribute('aria-valuenow', '1200');

    await pressKey(page, 'ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '480');

    await pressKeys(page, ['PageUp', 'PageUp', 'PageUp']);
    await expect(handle).toHaveAttribute('aria-valuenow', '660');

    await pressKey(page, 'PageUp');
    await expect(handle).toHaveAttribute('aria-valuenow', '780');
  });

  test('the keys on the end handle move only the end of a range', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const start = root.getByRole('slider', { name: 'Start time' });
    const end = root.getByRole('slider', { name: 'End time' });

    await pressKeys(page, ['Tab', 'Tab']);
    await pressKeys(page, ['ArrowRight', 'ArrowRight']);

    await expect(end).toHaveAttribute('aria-valuenow', '1060');
    await expect(start).toHaveAttribute('aria-valuenow', '540');

    await pressKey(page, 'Shift+Tab');
    await pressKey(page, 'ArrowLeft');

    await expect(start).toHaveAttribute('aria-valuenow', '535');
    await expect(end).toHaveAttribute('aria-valuenow', '1060');
  });
});

test.describe('time-picker / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse gestures');

  test('a drag moves the handle along the ring, snapped to the step', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const ring = root.locator(RING);
    const handle = root.getByRole('slider', { name: 'Time' });

    await mouseDownAlongRing(page, ring, 870, [920, 980, 1040, 1083]);

    await expect(handle).toHaveAttribute('data-dragging', 'true');
    await expect(handle).toHaveAttribute('aria-valuenow', '1080');

    await page.mouse.up();

    await expect(handle).not.toHaveAttribute('data-dragging');
    await expect(root.getByText(/^Value: 18:00:00/)).toBeVisible();
  });

  test('a drag stops at the edge of a blocked span', async ({ page }) => {
    const root = await openStory(page, OPENING_HOURS_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await mouseDownAlongRing(page, root.locator(RING), 630, [670, 710, 740, 770]);
    await page.mouse.up();

    await expect(handle).toHaveAttribute('aria-valuenow', '715');
  });

  test('a drag across a blocked span jumps to the open time on the other side', async ({ page }) => {
    const root = await openStory(page, OPENING_HOURS_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    const ring = root.locator(RING);

    await mouseDownAlongRing(page, ring, 630, [670, 710, 750]);
    await expect(handle).toHaveAttribute('aria-valuenow', '715');

    for (const minute of [790, 810]) {
      const point = await ringPoint(ring, minute);

      await page.mouse.move(point.x, point.y, { steps: 4 });
    }

    await page.mouse.up();

    await expect(handle).toHaveAttribute('aria-valuenow', '810');
  });

  test('a press in the centre of the ring leaves the time alone', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const centre = await ringCentre(root.locator(RING));

    await page.mouse.click(centre.x, centre.y);

    await expect(root.getByRole('slider', { name: 'Time' })).toHaveAttribute('aria-valuenow', '870');
  });

  test('a press on a range moves the nearer handle', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const start = root.getByRole('slider', { name: 'Start time' });
    const end = root.getByRole('slider', { name: 'End time' });

    await clickRing(page, root.locator(RING), 19 * 60);

    await expect(end).toHaveAttribute('aria-valuenow', '1140');
    await expect(end).toBeFocused();
    await expect(end).toHaveAttribute('data-active', 'true');
    await expect(start).toHaveAttribute('aria-valuenow', '540');
  });
});

test.describe('time-picker / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: touch gestures');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on the ring sets the time', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await tapRing(page, root.locator(RING), 6 * 60);

    await expect(handle).toHaveAttribute('aria-valuenow', '360');
    await expect(handle).toBeVisible();
  });

  test('a finger drag moves the handle along the ring', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await touchDragAlongRing(page, root.locator(RING), 870, [900, 940, 980, 1020, 1060, 1083]);

    await expect(handle).toHaveAttribute('aria-valuenow', '1080');
    await expect(handle).not.toHaveAttribute('data-dragging');
    await expect(root.getByText(/^Value: 18:00:00/)).toBeVisible();
  });

  test('a finger drag on a range moves the end it started nearest to', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const start = root.getByRole('slider', { name: 'Start time' });
    const end = root.getByRole('slider', { name: 'End time' });

    await touchDragAlongRing(page, root.locator(RING), 1050, [1080, 1110, 1140, 1170, 1200]);

    await expect(end).toHaveAttribute('aria-valuenow', '1200');
    await expect(start).toHaveAttribute('aria-valuenow', '540');
  });

  test('a tap on an empty range sets the start and hands the active side to the end', async ({ page }) => {
    const root = await openStory(page, RANGE_HAND_OFF_STORY_ID);
    const ring = root.locator(RING);
    const start = root.getByRole('slider', { name: 'Start time' });
    const end = root.getByRole('slider', { name: 'End time', includeHidden: true });

    await tapRing(page, ring, 9 * 60);

    await expect(start).toHaveAttribute('aria-valuenow', '540');
    await expect(end).toHaveAttribute('data-active', 'true');
    await expect(root.getByText('Hand-off: end')).toBeVisible();

    await tapRing(page, ring, 17 * 60);

    await expect(end).toHaveAttribute('aria-valuenow', '1020');
    await expect(start).toHaveAttribute('aria-valuenow', '540');
  });
});
