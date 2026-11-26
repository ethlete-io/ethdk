import { Locator, Page, expect, test } from '@playwright/test';
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
const DISABLED_STORY_ID = 'components-date-time-time-picker--disabled';
const RANGE_DISABLED_STORY_ID = 'components-date-time-time-picker--range-disabled';
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

  test('Tab reaches the handle of an empty picker, and a key sets the first time', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await pressKey(page, 'Tab');

    await expect(handle).toBeFocused({ timeout: 1_000 });
    await expect(handle).not.toHaveAttribute('aria-valuenow');

    await pressKey(page, 'ArrowUp');

    await expect(handle).toHaveAttribute('aria-valuenow', /^\d+$/);
    await expect(handle).not.toHaveAttribute('data-empty');
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

async function cursorAt(page: Page, point: TouchPoint): Promise<string> {
  return page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);

    return element ? getComputedStyle(element).cursor : 'none';
  }, point);
}

async function handlePoint(handle: Locator): Promise<TouchPoint> {
  const box = await boxOf(handle);

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('time-picker / interaction states', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover and drag');

  test('hovering a handle of a range lifts a halo and tints it, and the active handle keeps its fill', async ({
    page,
  }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const start = root.getByRole('slider', { name: 'Start time' });
    const end = root.getByRole('slider', { name: 'End time' });

    await page.mouse.move(0, 0);
    const restBackground = await end.evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect(end).toHaveCSS('box-shadow', 'none');

    const endPoint = await handlePoint(end);
    await page.mouse.move(endPoint.x, endPoint.y);

    await expect(end).not.toHaveCSS('box-shadow', 'none');
    await expect(end).not.toHaveCSS('background-color', restBackground);

    await expect(start).toHaveAttribute('data-active', 'true');
    const activeFill = await start.evaluate((el) => getComputedStyle(el).backgroundColor);
    const startPoint = await handlePoint(start);
    await page.mouse.move(startPoint.x, startPoint.y);

    await expect(start).not.toHaveCSS('box-shadow', 'none');
    await expect(start).toHaveCSS('background-color', activeFill);
  });

  test('hovering the single handle widens its halo', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await page.mouse.move(0, 0);
    const rest = await handle.evaluate((el) => getComputedStyle(el).boxShadow);
    const point = await handlePoint(handle);
    await page.mouse.move(point.x, point.y);

    await expect.poll(() => handle.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe(rest);
  });

  test('dragging shows the grabbing cursor and a stronger halo than hovering', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const ring = root.locator(RING);
    const handle = root.getByRole('slider', { name: 'Time' });

    const point = await handlePoint(handle);
    await page.mouse.move(point.x, point.y);
    const hovered = await handle.evaluate((el) => getComputedStyle(el).boxShadow);

    await mouseDownAlongRing(page, ring, 870, [900, 930]);

    await expect(handle).toHaveAttribute('data-dragging', 'true');
    await expect(handle).toHaveCSS('cursor', 'grabbing');
    await expect.poll(() => handle.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe(hovered);

    await page.mouse.up();
  });

  test('the track and the arc show a pointer cursor but no hover style', async ({ page }) => {
    const root = await openStory(page, RANGE_STORY_ID);
    const ring = root.locator(RING);
    const arcPoint = await ringPoint(ring, 13 * 60);
    const trackPoint = await ringPoint(ring, 3 * 60);
    const paint = (point: TouchPoint) =>
      page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        const style = element ? getComputedStyle(element) : null;

        return `${element?.getAttribute('class')} ${style?.stroke} ${style?.opacity}`;
      }, point);

    await page.mouse.move(0, 0);
    const restArc = await paint(arcPoint);
    const restTrack = await paint(trackPoint);

    await page.mouse.move(arcPoint.x, arcPoint.y);
    expect(await cursorAt(page, arcPoint)).toBe('pointer');
    expect(await paint(arcPoint)).toBe(restArc);

    await page.mouse.move(trackPoint.x, trackPoint.y);
    expect(await cursorAt(page, trackPoint)).toBe('pointer');
    expect(await paint(trackPoint)).toBe(restTrack);
  });

  test('a handle transitions its state changes, and not under reduced motion', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });
    const transition = () => handle.evaluate((el) => getComputedStyle(el).transitionDuration);

    expect(await transition()).toContain('0.12s');
    await expect(handle).toHaveCSS('transition-property', /box-shadow/);

    await page.emulateMedia({ reducedMotion: 'reduce' });

    await expect.poll(transition).toBe('0s');
  });

  test('a focused handle draws a solid two pixel outline', async ({ page }) => {
    const root = await openStory(page, WITH_VALUE_STORY_ID);
    const handle = root.getByRole('slider', { name: 'Time' });

    await pressKey(page, 'Tab');

    await expectFocusVisible(handle);
    await expect(handle).toHaveCSS('outline-style', 'solid');
    await expect(handle).toHaveCSS('outline-width', '2px');
  });

  for (const [name, storyId, handleNames] of [
    ['single', DISABLED_STORY_ID, ['Time']],
    ['range', RANGE_DISABLED_STORY_ID, ['Start time', 'End time']],
  ] as const) {
    test(`a disabled ${name} picker mutes the dial, blocks every gesture and takes its handles out of the tab order`, async ({
      page,
    }) => {
      const root = await openStory(page, storyId);
      const ring = root.locator(RING);
      const dial = root.locator('et-time-picker');
      const handles = handleNames.map((handleName) => root.getByRole('slider', { name: handleName }));
      const before = await Promise.all(handles.map((handle) => handle.getAttribute('aria-valuenow')));

      await expect(dial).toHaveCSS('opacity', '0.4');

      await page.mouse.move(0, 0);
      const restShadows = await Promise.all(
        handles.map((handle) => handle.evaluate((el) => getComputedStyle(el).boxShadow)),
      );

      for (const [index, handle] of handles.entries()) {
        await expect(handle).toHaveAttribute('aria-disabled', 'true');
        await expect(handle).toHaveAttribute('tabindex', '-1');
        await expect(handle).toHaveCSS('cursor', 'not-allowed');

        const point = await handlePoint(handle);
        await page.mouse.move(point.x, point.y);
        await expect(handle).toHaveCSS('box-shadow', restShadows[index] ?? '');
      }

      const trackPoint = await ringPoint(ring, 6 * 60);
      await page.mouse.move(trackPoint.x, trackPoint.y);
      expect(await cursorAt(page, trackPoint)).toBe('not-allowed');

      await pressKey(page, 'Tab');
      for (const handle of handles) {
        await expect(handle).not.toBeFocused();
      }

      await clickRing(page, ring, 20 * 60);
      await mouseDownAlongRing(page, ring, 9 * 60, [10 * 60, 11 * 60]);
      await page.mouse.up();

      for (const [index, handle] of handles.entries()) {
        await expect(handle).not.toHaveAttribute('data-dragging');
        await expect(handle).toHaveAttribute('aria-valuenow', before[index] ?? '');
      }
    });
  }
});
