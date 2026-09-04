import { Page, expect, test } from '@playwright/test';
import { focusedDescriptor, openStory, pressKey, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-overlays-filter-overlay--default';
const WITHOUT_PREVIEW_STORY_ID = 'components-overlays-filter-overlay--without-preview';

const DIALOG_ROOT = '[role="dialog"]';
const PANE = '.et-overlay';
const SUBMIT_BUTTON = '.et-filter-overlay-submit';
const RESET_BUTTON = '.et-filter-overlay-reset';

async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator(PANE)).toHaveClass(/et-animation-enter-done/);
}

test.describe('filter-overlay / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('clicking the trigger opens the overlay and moves initial focus inside it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    await expect(page.locator(DIALOG_ROOT)).toBeVisible();
    await expect(page.locator(`${PANE} :focus`)).toHaveCount(1);
  });

  test('Escape closes the overlay and returns focus to the trigger', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Filters', exact: true });
    await trigger.click();

    await waitForEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('filter-overlay / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: focus trap and draft editing');

  test('Tab cycles through the five enabled controls (reset is disabled while pristine) and wraps', async ({
    page,
  }) => {
    const root = await openStory(page, WITHOUT_PREVIEW_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    const initial = await focusedDescriptor(page);
    const sequence = await tabSequence(page, 5);

    expect(sequence[4]).toEqual(initial);
  });

  test('Shift+Tab wraps from the first control to the last', async ({ page }) => {
    const root = await openStory(page, WITHOUT_PREVIEW_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    await pressKey(page, 'Shift+Tab');

    await expect(page.locator(SUBMIT_BUTTON)).toBeFocused();
  });

  test('the preview count updates as the draft filters change', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    const submitButton = page.locator(SUBMIT_BUTTON);
    await expect(submitButton).toHaveText('Show more than 12 results');

    await page.getByRole('textbox', { name: 'Search' }).fill('Leipzig');

    await expect(submitButton).toHaveText('Show 2 results');
  });

  test('submit commits the draft, updates the page, and closes the overlay', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    await page.getByRole('textbox', { name: 'Search' }).fill('Leipzig');

    const submitButton = page.locator(SUBMIT_BUTTON);
    await expect(submitButton).toHaveText('Show 2 results');
    await submitButton.click();

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
    await expect(root.locator('.et-sb-applied')).toHaveText('search=Leipzig region=all division=all');
    await expect(root.locator('.et-sb-filter-overlay-team')).toHaveCount(2);
  });

  test('reset returns the draft to its defaults without closing, and disables again once pristine', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    const resetButton = page.locator(RESET_BUTTON);
    const searchInput = page.getByRole('textbox', { name: 'Search' });
    const submitButton = page.locator(SUBMIT_BUTTON);

    await expect(resetButton).toBeDisabled();

    await searchInput.fill('Leipzig');
    await expect(resetButton).toBeEnabled();

    await resetButton.click();

    await expect(searchInput).toHaveValue('');
    await expect(resetButton).toBeDisabled();
    await expect(submitButton).toHaveText('Show more than 12 results');
    await expect(page.locator(DIALOG_ROOT)).toHaveCount(1);
  });

  test('dismissing without submitting discards the draft', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    await page.getByRole('textbox', { name: 'Search' }).fill('Leipzig');
    await expect(page.locator(SUBMIT_BUTTON)).toHaveText('Show 2 results');

    await pressKey(page, 'Escape');

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
    await expect(root.locator('.et-sb-applied')).toHaveText('search=- region=all division=all');
  });

  test('without a preview configured, the submit button reads "Show results" and stays enabled', async ({ page }) => {
    const root = await openStory(page, WITHOUT_PREVIEW_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();

    await waitForEntered(page);

    const submitButton = page.locator(SUBMIT_BUTTON);
    await expect(submitButton).toHaveText('Show results');
    await expect(submitButton).toBeEnabled();
  });
});

test.describe('filter-overlay / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('a tap on the trigger opens the overlay', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await tap(root.getByRole('button', { name: 'Filters', exact: true }));

    await waitForEntered(page);

    await expect(page.locator(DIALOG_ROOT)).toBeVisible();
  });

  test('a tap on the back control closes the overlay', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await tap(root.getByRole('button', { name: 'Filters', exact: true }));

    await waitForEntered(page);

    await tap(page.getByRole('button', { name: 'Back' }));

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
  });

  test('a tap on submit commits the draft and closes the overlay', async ({ page }) => {
    const root = await openStory(page, WITHOUT_PREVIEW_STORY_ID);
    await tap(root.getByRole('button', { name: 'Filters', exact: true }));

    await waitForEntered(page);

    await tap(page.locator(SUBMIT_BUTTON));

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
  });
});
