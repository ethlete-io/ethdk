import { expect, test } from '@playwright/test';
import { countClicks, expectFocusVisible, expectTouchMode, openStory, pressKey, tabSequence, tap } from '../support';

const INFO_STORY_ID = 'components-feedback-banner--info';
const SUCCESS_STORY_ID = 'components-feedback-banner--success';
const WARNING_STORY_ID = 'components-feedback-banner--warning';
const ERROR_STORY_ID = 'components-feedback-banner--error';
const WITHOUT_DISMISS_STORY_ID = 'components-feedback-banner--without-dismiss';

const BANNER = '.et-banner';
const DISMISS_BUTTON = '.et-banner-dismiss-btn';
const ACTION = '[etBannerAction]';

test.describe('banner / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the projected action with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(ACTION));
  });

  test('Tab reaches the dismiss button with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(DISMISS_BUTTON));
  });

  test('the dismiss button follows the actions in the tab order', async ({ page }) => {
    await openStory(page, INFO_STORY_ID);

    const sequence = await tabSequence(page, 2);

    expect(sequence.map((descriptor) => descriptor.text)).toEqual(['Retry', '']);
    expect(sequence[1]?.name).toBe('Dismiss');
  });

  test('a banner without actions puts the dismiss button first in the tab order', async ({ page }) => {
    const root = await openStory(page, SUCCESS_STORY_ID);

    await expect(root.locator(ACTION)).toHaveCount(0);

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(DISMISS_BUTTON));
  });

  test('a non-dismissible banner has no dismiss button in the tab order', async ({ page }) => {
    const root = await openStory(page, WITHOUT_DISMISS_STORY_ID);

    await expect(root.locator(DISMISS_BUTTON)).toHaveCount(0);

    const sequence = await tabSequence(page, 2);

    expect(sequence[0]?.text).toBe('Retry');
    expect(sequence[1]?.name).not.toBe('Dismiss');
  });

  test('the dismiss button is labelled for assistive technology', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await expect(root.getByRole('button', { name: 'Dismiss', exact: true })).toHaveClass(/et-banner-dismiss-btn/);
  });

  test('an info banner announces politely through a status role', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'status');
  });

  test('a success banner announces politely through a status role', async ({ page }) => {
    const root = await openStory(page, SUCCESS_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'status');
  });

  test('a warning banner interrupts through an alert role', async ({ page }) => {
    const root = await openStory(page, WARNING_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'alert');
  });

  test('an error banner interrupts through an alert role', async ({ page }) => {
    const root = await openStory(page, ERROR_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'alert');
  });
});

test.describe('banner / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter on the dismiss button emits dismiss', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await countClicks(dismissButton);

    await pressKey(page, 'Enter');

    await expect(dismissButton).toHaveJSProperty('__clicks', 1);
  });

  test('Space on the dismiss button emits dismiss', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await countClicks(dismissButton);

    await pressKey(page, ' ');

    await expect(dismissButton).toHaveJSProperty('__clicks', 1);
  });

  test('dismissing leaves the banner in place for its consumer to remove, and keeps focus', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await pressKey(page, 'Enter');

    await expect(root.locator(BANNER)).toBeVisible();
    await expect(dismissButton).toBeFocused();
  });

  test('Enter on the projected action activates it without dismissing the banner', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const action = root.locator(ACTION);

    await action.focus();
    await countClicks(action);

    await pressKey(page, 'Enter');

    await expect(action).toHaveJSProperty('__clicks', 1);
    await expect(root.locator(BANNER)).toBeVisible();
  });

  test('Escape does not dismiss a banner', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await countClicks(dismissButton);

    await pressKey(page, 'Escape');

    await expect(dismissButton).toHaveJSProperty('__clicks', 0);
    await expect(root.locator(BANNER)).toBeVisible();
  });
});

test.describe('banner / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, INFO_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on the dismiss button emits dismiss', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await countClicks(dismissButton);

    await tap(dismissButton);

    await expect(dismissButton).toHaveJSProperty('__clicks', 1);
    await expect(root.locator(BANNER)).toBeVisible();
  });

  test('a tap on the projected action activates it', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const action = root.locator(ACTION);

    await countClicks(action);

    await tap(action);

    await expect(action).toHaveJSProperty('__clicks', 1);
  });

  test('a non-dismissible banner renders no dismiss target', async ({ page }) => {
    const root = await openStory(page, WITHOUT_DISMISS_STORY_ID);

    await expect(root.locator(BANNER)).toBeVisible();
    await expect(root.locator(DISMISS_BUTTON)).toHaveCount(0);
  });
});
