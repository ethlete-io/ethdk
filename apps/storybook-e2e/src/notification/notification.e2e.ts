import { expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap, touchSwipe } from '../support';

const BOTTOM_END_STORY_ID = 'components-feedback-notification--bottom-end';
const PROMISE_API_STORY_ID = 'components-feedback-notification--promise-api';
const TOP_CENTER_STORY_ID = 'components-feedback-notification--top-center';
const RTL_STORY_ID = 'components-feedback-notification--bottom-end-right-to-left';

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

    for (let i = 0; i < 20 && !(await dismissButton.evaluate((el) => el === document.activeElement)); i++) {
      await pressKey(page, 'Tab');
    }

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

    await page.waitForTimeout(4300);
    await expect(notification).toBeVisible();
  });

  test('a sticky notification never auto-dismisses', async ({ page }) => {
    const root = await openStory(page, BOTTOM_END_STORY_ID);
    await root.getByRole('button', { name: 'Loading', exact: true }).click();

    await page.waitForTimeout(4300);
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

    const stackBox = await stack.boundingBox();
    const notificationBox = await notification.boundingBox();
    if (!stackBox || !notificationBox) throw new Error('missing bounding box');

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
    const box = await notification.boundingBox();
    if (!box) throw new Error('notification has no bounding box');

    const y = box.y + box.height / 2;

    await touchSwipe(page, { x: box.x + box.width * 0.2, y }, { x: box.x + box.width * 0.9, y });

    await expect(notification).toHaveCount(0);
  });
});
