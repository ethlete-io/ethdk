import { Page, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tabUntilFocused, tap } from '../support';

const STORY_ID = 'components-overlays-alert-dialog--default';

const PANE = '.et-overlay';

async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator(PANE)).toHaveClass(/et-animation-enter-done/);
}

test.describe('alert dialog / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard contract');

  test('a confirm opens as a named, described alertdialog with focus on the cancel action', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Delete project' });
    await tabUntilFocused(page, trigger);
    await pressKey(page, 'Enter');

    const dialog = page.getByRole('alertdialog', { name: 'Delete project?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleDescription(/This cannot be undone\./);

    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    await expect(cancel).toBeFocused();
    await expectFocusVisible(cancel);
  });

  test('Escape cancels, reports false and returns focus to the trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Delete project' });
    await tabUntilFocused(page, trigger);
    await pressKey(page, 'Enter');
    await waitForEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(root.getByTestId('alert-dialog-result')).toHaveText('Result: false');
    await expect(trigger).toBeFocused();
  });

  test('Tab stays inside the dialog and Enter on the confirm action reports true', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await tabUntilFocused(page, root.getByRole('button', { name: 'Delete project' }));
    await pressKey(page, 'Enter');
    await waitForEntered(page);

    const dialog = page.getByRole('alertdialog');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const confirm = dialog.getByRole('button', { name: 'Delete project' });

    await pressKey(page, 'Tab');
    await expect(confirm).toBeFocused();
    await pressKey(page, 'Tab');
    await expect(cancel).toBeFocused();
    await pressKey(page, 'Shift+Tab');
    await expect(confirm).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(dialog).toHaveCount(0);
    await expect(root.getByTestId('alert-dialog-result')).toHaveText('Result: true');
  });

  test('an alert focuses its only action and reports its acknowledgement', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await tabUntilFocused(page, root.getByRole('button', { name: 'Show alert' }));
    await pressKey(page, 'Enter');

    const dialog = page.getByRole('alertdialog', { name: 'Export finished' });
    await expect(dialog.getByRole('button', { name: 'OK' })).toBeFocused();

    await waitForEntered(page);
    await pressKey(page, 'Enter');

    await expect(dialog).toHaveCount(0);
    await expect(root.getByTestId('alert-dialog-result')).toHaveText('Result: acknowledged');
  });
});

test.describe('alert dialog / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only');

  test('a press on the backdrop leaves the dialog open', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await root.getByRole('button', { name: 'Publish' }).click();
    await waitForEntered(page);

    await page.locator('.et-overlay-runtime-backdrop').click({ position: { x: 5, y: 5 } });

    await expect(page.getByRole('alertdialog', { name: 'Publish the draft?' })).toBeVisible();
    await expect(root.getByTestId('alert-dialog-result')).toHaveText('Result: none');
  });
});

test.describe('alert dialog / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('tapping the cancel action reports false', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await tap(root.getByRole('button', { name: 'Delete project' }));
    await waitForEntered(page);

    await tap(page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }));

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(root.getByTestId('alert-dialog-result')).toHaveText('Result: false');
  });
});
