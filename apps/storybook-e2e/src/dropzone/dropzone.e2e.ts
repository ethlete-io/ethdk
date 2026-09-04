import { Page, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-dropzone--default';
const MULTIPLE_ID = 'components-forms-dropzone--multiple';
const EXISTING_MEDIA_ID = 'components-forms-dropzone--existing-media';
const READONLY_ID = 'components-forms-dropzone--readonly';
const READONLY_SINGLE_ID = 'components-forms-dropzone--readonly-single';

const TRIGGER = '.et-dropzone-trigger';
const NATIVE_INPUT = '.et-dropzone-native-input';

/** Attaches a `Files` `DataTransfer` (no real file needed) for a drag event init. */
async function filesDataTransfer(page: Page) {
  return page.evaluateHandle(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['content'], 'photo.png', { type: 'image/png' }));
    return dataTransfer;
  });
}

test.describe('dropzone / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the browse trigger and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const trigger = root.locator(TRIGGER);

    await pressKey(page, 'Tab');

    await expectFocusVisible(trigger);
  });

  test('in single mode with a preview, Tab skips the trigger for the replace button', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { initialValue: 'mountain' } });
    const trigger = root.locator(TRIGGER);
    const replace = root.locator('.et-dropzone-replace-button');

    await expect(trigger).toHaveAttribute('tabindex', '-1');

    await pressKey(page, 'Tab');

    await expectFocusVisible(replace);
  });

  test('Tab reaches a remove button in multiple mode', async ({ page }) => {
    const root = await openStory(page, EXISTING_MEDIA_ID);
    const remove = root.locator('.et-dropzone-remove-button').first();

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(remove);
  });
});

test.describe('dropzone / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: file chooser activation');

  test('Enter on the focused trigger opens the file chooser', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const trigger = root.locator(TRIGGER);

    await pressKey(page, 'Tab');
    await expect(trigger).toBeFocused();

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), pressKey(page, 'Enter')]);

    expect(chooser).toBeTruthy();
  });

  test('Space on the focused trigger opens the file chooser', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const trigger = root.locator(TRIGGER);

    await pressKey(page, 'Tab');
    await expect(trigger).toBeFocused();

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), pressKey(page, ' ')]);

    expect(chooser).toBeTruthy();
  });

  test('a file added through the hidden input renders a media item in single mode', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const nativeInput = root.locator(NATIVE_INPUT);

    await nativeInput.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('content') });

    await expect(root.locator('.et-dropzone-preview')).toBeVisible();
    await expect(root.locator('.et-dropzone-entry-name')).toHaveText('avatar.png');
  });

  test('a file added through the hidden input renders a media item in multiple mode', async ({ page }) => {
    const root = await openStory(page, MULTIPLE_ID);
    const nativeInput = root.locator(NATIVE_INPUT);

    await nativeInput.setInputFiles({
      name: 'report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('content'),
    });

    await expect(root.locator('.et-dropzone-item')).toHaveCount(1);
    await expect(root.locator('.et-dropzone-entry-name')).toHaveText('report.pdf');
  });

  test('the remove button removes the item', async ({ page }) => {
    const root = await openStory(page, EXISTING_MEDIA_ID);

    await expect(root.locator('.et-dropzone-item')).toHaveCount(2);

    await root.locator('.et-dropzone-remove-button').first().click();

    await expect(root.locator('.et-dropzone-item')).toHaveCount(1);
  });

  test('a readonly dropzone with entries offers no add or remove control', async ({ page }) => {
    const root = await openStory(page, READONLY_ID);

    await expect(root.locator(TRIGGER)).not.toBeVisible();
    await expect(root.locator('.et-dropzone-remove-button')).toHaveCount(0);
    await expect(root.locator('.et-dropzone-item')).toHaveCount(2);
  });

  test('a readonly single dropzone keeps the preview but offers no replace or remove control', async ({ page }) => {
    const root = await openStory(page, READONLY_SINGLE_ID);

    await expect(root.locator('.et-dropzone-preview')).toBeVisible();
    await expect(root.locator('.et-dropzone-replace-button')).toHaveCount(0);
    await expect(root.locator('.et-dropzone-remove-button')).toHaveCount(0);
  });

  test('dragging files over the dropzone sets the drag-over state and dragleave clears it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const dropzone = root.locator('et-dropzone');
    const dataTransfer = await filesDataTransfer(page);

    await dropzone.dispatchEvent('dragenter', { dataTransfer });
    await dropzone.dispatchEvent('dragover', { dataTransfer });

    await expect(dropzone).toHaveAttribute('data-drag-over', 'true');

    await dropzone.dispatchEvent('dragleave');

    await expect(dropzone).not.toHaveAttribute('data-drag-over', 'true');
  });
});

test.describe('dropzone / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the trigger opens the file chooser', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const trigger = root.locator(TRIGGER);

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap(trigger)]);

    expect(chooser).toBeTruthy();
  });
});
