import { Locator, Page, expect, test } from '@playwright/test';
import { expectFocusVisible, expectTouchMode, openStory, pressKey, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-feedback-query-error--default';
const VIOLATION_LIST_STORY_ID = 'components-feedback-query-error--violation-list';
const RETRYABLE_STORY_ID = 'components-feedback-query-error--retryable';
const EMPTY_BODY_STORY_ID = 'components-feedback-query-error--empty-body';
const CUSTOM_SLOTS_STORY_ID = 'components-feedback-query-error--custom-slots';

const PANEL = '.et-query-error';
const BANNER = '.et-banner';
const ICON = '.et-query-error .et-icon';
const ACTIONS = '.et-query-error-actions';
const RETRY_BUTTON = '.et-query-error-actions button';
const LIST = 'ul.et-query-error-list';

function retryCounter(root: Locator): Locator {
  return root.getByText(/^Retries triggered: \d+$/);
}

function openRetryableStory(page: Page): Promise<Locator> {
  return openStory(page, RETRYABLE_STORY_ID, { args: { alwaysAllowRetry: true } });
}

test.describe('query-error / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('the panel announces itself through an assertive alert role', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(PANEL)).toHaveAttribute('role', 'alert');
  });

  test('the banner inside the alert carries no live region of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const banner = root.locator(BANNER);

    await expect(banner).toBeVisible();
    await expect(banner).not.toHaveAttribute('role');
  });

  test('the status icon is hidden from assistive technology', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(ICON).first()).toHaveAttribute('aria-hidden', 'true');
  });

  test('a violation list is announced as a real list', async ({ page }) => {
    const root = await openStory(page, VIOLATION_LIST_STORY_ID);

    await expect(root.locator(LIST)).toBeVisible();
    await expect(root.locator(`${LIST} > li`)).toHaveCount(3);
  });

  test('a retryable failure offers a retry button', async ({ page }) => {
    const root = await openStory(page, RETRYABLE_STORY_ID);

    await expect(root.locator(RETRY_BUTTON)).toBeVisible();
  });

  test('a failure the policy considers final renders no retry button', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(PANEL)).toBeVisible();
    await expect(root.locator(ACTIONS)).toHaveCount(0);
    await expect(root.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  });

  test('a failure the policy considers final keeps the retry button out of the tab order', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, 2);

    expect(sequence[0]?.text).toBe('Locale: en');
    expect(sequence[1]?.text).not.toBe('Retry');
  });

  test('alwaysAllowRetry offers a retry on a failure the policy considers final', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { alwaysAllowRetry: true } });

    await expect(root.locator(RETRY_BUTTON)).toHaveText('Retry');
  });

  test('Tab reaches the retry button with a visible focus ring', async ({ page }) => {
    const root = await openRetryableStory(page);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(RETRY_BUTTON));
  });

  test('the retry button follows the panel in the tab order', async ({ page }) => {
    await openRetryableStory(page);

    const sequence = await tabSequence(page, 2);

    expect(sequence.map((descriptor) => descriptor.text)).toEqual(['Locale: en', 'Retry']);
  });

  test('the actions slot replaces the retry button in the tab order', async ({ page }) => {
    const root = await openStory(page, CUSTOM_SLOTS_STORY_ID);

    await expect(root.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);

    const sequence = await tabSequence(page, 3);

    expect(sequence.map((descriptor) => descriptor.text)).toEqual(['Locale: en', 'Try again', 'Contact support']);
  });

  test('a slot action button takes a visible focus ring', async ({ page }) => {
    const root = await openStory(page, CUSTOM_SLOTS_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(root.getByRole('button', { name: 'Try again', exact: true }));
  });

  test('a slot action link takes a visible focus ring', async ({ page }) => {
    const root = await openStory(page, CUSTOM_SLOTS_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(root.getByRole('link', { name: 'Contact support', exact: true }));
  });

  test('an empty response body still renders an announced panel', async ({ page }) => {
    const root = await openStory(page, EMPTY_BODY_STORY_ID);

    await expect(root.locator(PANEL)).toHaveAttribute('role', 'alert');
    await expect(root.locator(PANEL)).toHaveAttribute('data-status', '500');
  });
});

test.describe('query-error / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter on the retry button re-executes the query', async ({ page }) => {
    const root = await openRetryableStory(page);

    await root.locator(RETRY_BUTTON).focus();
    await pressKey(page, 'Enter');

    await expect(retryCounter(root)).toHaveText('Retries triggered: 1');
  });

  test('Space on the retry button re-executes the query', async ({ page }) => {
    const root = await openRetryableStory(page);

    await root.locator(RETRY_BUTTON).focus();
    await pressKey(page, ' ');

    await expect(retryCounter(root)).toHaveText('Retries triggered: 1');
  });

  test('retrying keeps focus on the retry button and leaves the panel in place', async ({ page }) => {
    const root = await openRetryableStory(page);
    const retryButton = root.locator(RETRY_BUTTON);

    await retryButton.focus();
    await pressKey(page, 'Enter');

    await expect(retryButton).toBeFocused();
    await expect(root.locator(PANEL)).toBeVisible();
  });

  test('Escape on the retry button does not retry', async ({ page }) => {
    const root = await openRetryableStory(page);

    await root.locator(RETRY_BUTTON).focus();
    await pressKey(page, 'Escape');

    await expect(retryCounter(root)).toHaveText('Retries triggered: 0');
  });

  test('Enter on a slot action runs the slot handler', async ({ page }) => {
    const root = await openStory(page, CUSTOM_SLOTS_STORY_ID);

    await root.getByRole('button', { name: 'Try again', exact: true }).focus();
    await pressKey(page, 'Enter');

    await expect(retryCounter(root)).toHaveText('Retries triggered: 1');
  });
});

test.describe('query-error / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on the retry button re-executes the query', async ({ page }) => {
    const root = await openRetryableStory(page);

    await tap(root.locator(RETRY_BUTTON));

    await expect(retryCounter(root)).toHaveText('Retries triggered: 1');
  });

  test('a second tap retries again', async ({ page }) => {
    const root = await openRetryableStory(page);

    await tap(root.locator(RETRY_BUTTON));
    await tap(root.locator(RETRY_BUTTON));

    await expect(retryCounter(root)).toHaveText('Retries triggered: 2');
  });

  test('a failure the policy considers final renders no retry target', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(PANEL)).toBeVisible();
    await expect(root.locator(ACTIONS)).toHaveCount(0);
  });

  test('a tap on a slot action runs the slot handler', async ({ page }) => {
    const root = await openStory(page, CUSTOM_SLOTS_STORY_ID);

    await tap(root.getByRole('button', { name: 'Try again', exact: true }));

    await expect(retryCounter(root)).toHaveText('Retries triggered: 1');
  });
});
