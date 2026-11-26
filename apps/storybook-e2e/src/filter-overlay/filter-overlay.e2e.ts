import { Locator, Page, expect, test } from '@playwright/test';
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

async function press(locator: Locator, isMobile: boolean): Promise<void> {
  await (isMobile ? tap(locator) : locator.click());
}

async function openAndApply(trigger: Locator, dialog: Locator, isMobile: boolean, path: [string, string]) {
  const page = trigger.page();

  await press(trigger, isMobile);
  await waitForEntered(page);
  await press(dialog.getByRole('button', { name: path[0] }), isMobile);
  await press(dialog.getByRole('radio', { name: path[1] }), isMobile);
  await press(page.locator(SUBMIT_BUTTON), isMobile);
  await expect(dialog).toHaveCount(0);
}

async function openAndReset(page: Page, trigger: Locator, isMobile: boolean) {
  await press(trigger, isMobile);
  await waitForEntered(page);
  await press(page.locator(RESET_BUTTON), isMobile);
  await press(page.locator(SUBMIT_BUTTON), isMobile);
  await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
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

test.describe('filter-overlay / routed pages', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus on navigation');

  test('a sub page takes focus, and its choice is kept in the draft when Back returns to the main page', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();
    await waitForEntered(page);

    const dialog = page.locator(DIALOG_ROOT);
    await dialog.getByRole('button', { name: 'Region - All regions' }).click();

    await expect(dialog.getByRole('heading')).toHaveText('Region');
    await expect(dialog.getByRole('radio', { name: 'All regions' })).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(dialog.getByRole('radio', { name: 'Europe' })).toBeChecked();

    await dialog.getByRole('button', { name: 'Back' }).click();

    await expect(dialog.getByRole('heading')).toHaveText('Filters');
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Region - Europe' })).toBeVisible();
    await expect(page.locator(SUBMIT_BUTTON)).toHaveText('Show 8 results');
  });

  test('submitting from a sub page applies its choice and closes the overlay', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await root.getByRole('button', { name: 'Filters', exact: true }).click();
    await waitForEntered(page);

    const dialog = page.locator(DIALOG_ROOT);
    await dialog.getByRole('button', { name: 'Division - All divisions' }).click();
    await dialog.getByRole('radio', { name: 'Youth' }).click();
    await page.locator(SUBMIT_BUTTON).click();

    await expect(dialog).toHaveCount(0);
    await expect(root.locator('.et-sb-applied')).toHaveText('search=- region=all division=youth');
  });
});

test.describe('filter-overlay / floating action badge', () => {
  test('the trigger shows the active filter count once filters are applied and drops it on reset', async ({
    page,
    isMobile,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: /^Filters/ });
    const dialog = page.locator(DIALOG_ROOT);

    await expect(trigger.locator('et-chip')).toHaveCount(0);

    await openAndApply(trigger, dialog, isMobile, ['Region - All regions', 'Europe']);
    await expect(trigger.locator('et-chip')).toHaveText('1');

    await openAndApply(trigger, dialog, isMobile, ['Division - All divisions', 'First division']);
    await expect(trigger.locator('et-chip')).toHaveText('2');

    await openAndReset(page, trigger, isMobile);
    await expect(trigger.locator('et-chip')).toHaveCount(0);
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
