import { CDPSession, Locator, Page, expect, test } from '@playwright/test';
import {
  Box,
  TouchPoint,
  boxOf,
  expectFocusVisible,
  openStory,
  pressKey,
  settle,
  tabUntilFocused,
  tap,
  touchDrag,
  touchSwipe,
} from '../support';

const BOTTOM_END_STORY_ID = 'components-feedback-notification--bottom-end';
const PROMISE_API_STORY_ID = 'components-feedback-notification--promise-api';
const TOP_CENTER_STORY_ID = 'components-feedback-notification--top-center';
const RTL_STORY_ID = 'components-feedback-notification--bottom-end-right-to-left';
const MIN_DISMISS_DISTANCE_PX = 64;
const DISMISS_DISTANCE_RATIO = 0.3;
const RESTING_TRANSFORM = /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/;

const NOTIFICATION = '.et-notification';
const DISMISS_BUTTON = '.et-notification-dismiss-btn';
const TITLE = '.et-notification-title';

test.describe('notification / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('opening a notification does not steal focus from its trigger', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Success', exact: true });

    await trigger.click();

    await expect(page.locator(NOTIFICATION)).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('a success notification renders a polite status live region', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();

    await expect(page.getByRole('status')).toBeVisible();
  });

  test('an error notification renders an alert live region', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Error', exact: true }).click();

    await expect(page.getByRole('alert')).toBeVisible();
  });
});

test.describe('notification / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: focus order and timers');

  test('Tab reaches the dismiss button with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Loading', exact: true }).focus();
    await pressKey(page, 'Enter');

    const dismissButton = page.locator(DISMISS_BUTTON);
    await expect(dismissButton).toBeVisible();

    await tabUntilFocused(page, dismissButton, 20);

    await expectFocusVisible(dismissButton);
  });

  test('the dismiss button closes the notification', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();

    await page.locator(DISMISS_BUTTON).click();

    await expect(page.locator(NOTIFICATION)).toHaveCount(0);
  });

  test('Escape dismisses a focused toast', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();

    await page.locator(DISMISS_BUTTON).focus();
    await pressKey(page, 'Escape');

    await expect(page.locator(NOTIFICATION)).toHaveCount(0);
  });

  test('a notification with no explicit duration auto-dismisses after its status default', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();

    await expect(page.locator(NOTIFICATION)).toHaveCount(0, { timeout: 4700 });
  });

  test('hovering a notification pauses its auto-dismiss timer', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();

    const notification = page.locator(NOTIFICATION);
    await notification.hover();

    await settle(page, 4300);
    await expect(notification).toBeVisible();
  });

  test('a sticky notification never auto-dismisses', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Loading', exact: true }).click();

    await settle(page, 4300);
    await expect(page.locator(NOTIFICATION)).toBeVisible();
  });

  test('opening more than maxVisible dismisses the oldest notification', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();
    await root.getByRole('button', { name: 'Info', exact: true }).click();
    await root.getByRole('button', { name: 'Error', exact: true }).click();

    await expect(page.locator(NOTIFICATION)).toHaveCount(3);
    await expect(page.locator(TITLE)).toHaveText(['Changes saved', 'Update available', 'Upload failed']);

    await root.getByRole('button', { name: 'With message', exact: true }).click();

    await expect(page.locator(NOTIFICATION)).toHaveCount(3);
    await expect(page.locator(TITLE)).not.toHaveText(['Changes saved', 'Update available', 'Upload failed']);
  });

  test('the promise API turns a pending notification into its settled result', async ({ page }) => {
    const root = await openStory(page, PROMISE_API_STORY_ID);
    await root.getByRole('button', { name: 'Promise resolves', exact: true }).click();

    await expect(page.getByRole('status')).toHaveText(/Saving…/);

    await expect(page.getByRole('status')).toHaveText(/Saved/, { timeout: 2500 });
  });

  test('the promise API turns a pending notification into an error result', async ({ page }) => {
    const root = await openStory(page, PROMISE_API_STORY_ID);
    await root.getByRole('button', { name: 'Promise rejects', exact: true }).click();

    await expect(page.getByRole('status')).toHaveText(/Saving…/);

    await expect(page.getByRole('alert')).toHaveText(/Could not save/, { timeout: 2500 });
  });

  test('the stack docks to the position its story configures', async ({ page }) => {
    const root = await openStory(page, TOP_CENTER_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();

    await expect(page.locator('.et-notification-stack')).toHaveAttribute('data-position', 'top-center');
  });

  test('under RTL, bottom-end docks to the physical left', async ({ page }) => {
    const root = await openStory(page, RTL_STORY_ID);
    await root.getByRole('button', { name: 'Success', exact: true }).click();

    const stack = page.locator('.et-notification-stack');
    const notification = page.locator(NOTIFICATION);

    await expect(stack).toHaveAttribute('data-position', 'bottom-end');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');

    const stackBox = await boxOf(stack);
    const notificationBox = await boxOf(notification);

    expect(notificationBox.x).toBeLessThan(stackBox.x + stackBox.width / 2);
  });
});

test.describe('notification / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap and swipe dismissal');

  test('a tap on the dismiss button closes the notification', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await tap(root.getByRole('button', { name: 'Success', exact: true }));

    await tap(page.locator(DISMISS_BUTTON));

    await expect(page.locator(NOTIFICATION)).toHaveCount(0);
  });

  test('a swipe toward the docked edge dismisses the notification', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await tap(root.getByRole('button', { name: 'Success', exact: true }));

    const notification = page.locator(NOTIFICATION);
    const box = await boxOf(notification);

    const y = box.y + box.height / 2;

    await touchSwipe(page, { x: box.x + box.width * 0.2, y }, { x: box.x + box.width * 0.9, y });

    await expect(notification).toHaveCount(0);
  });
});

interface Finger {
  moveTo(to: TouchPoint, steps?: number): Promise<void>;
  lift(holdMs?: number): Promise<void>;
}

async function putFingerDown(page: Page, at: TouchPoint): Promise<Finger> {
  const client: CDPSession = await page.context().newCDPSession(page);
  let current = at;

  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });

  return {
    moveTo: async (to, steps = 12) => {
      const from = current;

      for (let i = 1; i <= steps; i++) {
        const point = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };

        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
        await settle(page, 16);
      }

      current = to;
    },
    lift: async (holdMs = 0) => {
      await settle(page, holdMs);
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

async function openNotification(page: Page, storyId: string, status: string): Promise<Locator> {
  const root = await openStory(page, storyId);

  await tap(root.getByRole('button', { name: status, exact: true }));

  const notification = page.locator(NOTIFICATION);

  await expect(notification).toHaveClass(/et-animation-enter-done/);

  return notification;
}

function middleLeftOf(box: Box): TouchPoint {
  return { x: box.x + box.width * 0.4, y: box.y + box.height / 2 };
}

function dismissDistanceOf(box: Box): number {
  return Math.max(MIN_DISMISS_DISTANCE_PX, box.width * DISMISS_DISTANCE_RATIO);
}

async function slowDrag(page: Page, from: TouchPoint, dx: number, dy = 0): Promise<void> {
  const finger = await putFingerDown(page, from);

  await finger.moveTo({ x: from.x + dx, y: from.y + dy }, 40);
  await finger.lift(250);
}

async function expectResting(notification: Locator): Promise<void> {
  await expect(notification).toHaveCount(1);
  await expect(notification).toHaveCSS('transform', RESTING_TRANSFORM);
}

test.describe('notification / swipe', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: swipe thresholds');

  test('the notification follows the finger and fades as it goes', async ({ page }) => {
    const notification = await openNotification(page, BOTTOM_END_STORY_ID, 'Loading');
    const start = middleLeftOf(await boxOf(notification));
    const finger = await putFingerDown(page, start);

    await finger.moveTo({ x: start.x + 60, y: start.y });

    await expect
      .poll(() => notification.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41))
      .toBeCloseTo(60, -1);
    await expect.poll(() => notification.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1);

    await finger.lift(250);
  });

  test('a slow drag shorter than the dismiss distance slides back into the stack', async ({ page }) => {
    const notification = await openNotification(page, BOTTOM_END_STORY_ID, 'Loading');
    const box = await boxOf(notification);

    await slowDrag(page, middleLeftOf(box), dismissDistanceOf(box) - 20);

    await expectResting(notification);
  });

  test('a slow drag past the dismiss distance dismisses the notification', async ({ page }) => {
    const notification = await openNotification(page, BOTTOM_END_STORY_ID, 'Loading');
    const box = await boxOf(notification);

    await slowDrag(page, middleLeftOf(box), dismissDistanceOf(box) + 20);

    await expect(notification).toHaveCount(0);
  });

  test('a quick flick dismisses the notification before it reaches the dismiss distance', async ({ page }) => {
    await page.clock.install();
    const notification = await openNotification(page, BOTTOM_END_STORY_ID, 'Loading');
    const start = middleLeftOf(await boxOf(notification));

    await page.clock.pauseAt(Date.now() + 1000);
    await expect(notification).toHaveCount(1);
    await touchDrag(page, start, { x: start.x + 40, y: start.y }, { steps: 3, clock: true });
    await page.clock.resume();

    await expect(notification).toHaveCount(0);
  });

  test('a swipe away from the docked edge leaves the notification in place', async ({ page }) => {
    const notification = await openNotification(page, BOTTOM_END_STORY_ID, 'Loading');
    const start = middleLeftOf(await boxOf(notification));

    await touchSwipe(page, start, { x: start.x - 150, y: start.y }, 6);

    await settle(page, 300);
    await expectResting(notification);
  });

  test('a vertical drag is a page pan, not a swipe', async ({ page }) => {
    const notification = await openNotification(page, BOTTOM_END_STORY_ID, 'Loading');
    const start = middleLeftOf(await boxOf(notification));

    await touchSwipe(page, start, { x: start.x + 20, y: start.y - 120 }, 6);

    await settle(page, 300);
    await expectResting(notification);
  });

  test('a finger resting on a notification holds its auto-dismiss timer', async ({ page }) => {
    const notification = await openNotification(page, BOTTOM_END_STORY_ID, 'Success');
    const finger = await putFingerDown(page, middleLeftOf(await boxOf(notification)));

    await settle(page, 4700);
    await expect(notification).toBeVisible();

    await finger.lift();
  });

  test('under RTL, a bottom-end notification is swiped away to the left', async ({ page }) => {
    const notification = await openNotification(page, RTL_STORY_ID, 'Loading');
    const box = await boxOf(notification);
    const start = { x: box.x + box.width * 0.6, y: box.y + box.height / 2 };

    await touchSwipe(page, start, { x: start.x + 150, y: start.y }, 6);
    await settle(page, 300);
    await expectResting(notification);

    await touchSwipe(page, start, { x: start.x - 150, y: start.y }, 6);

    await expect(notification).toHaveCount(0);
  });

  test('a centred notification can be swiped away in either direction', async ({ page }) => {
    const notification = await openNotification(page, TOP_CENTER_STORY_ID, 'Loading');
    const box = await boxOf(notification);
    const start = { x: box.x + box.width * 0.6, y: box.y + box.height / 2 };

    await touchSwipe(page, start, { x: start.x - 150, y: start.y }, 6);

    await expect(notification).toHaveCount(0);
  });
});

test.describe('notification / pointer swipe', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only');

  test('a mouse drag toward the docked edge dismisses the notification', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);

    await root.getByRole('button', { name: 'Loading', exact: true }).click();

    const notification = page.locator(NOTIFICATION);

    await expect(notification).toHaveClass(/et-animation-enter-done/);

    const start = middleLeftOf(await boxOf(notification));

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 200, start.y, { steps: 10 });
    await page.mouse.up();

    await expect(notification).toHaveCount(0);
  });
});
