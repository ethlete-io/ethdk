import { JSHandle, Locator, Page, expect, test } from '@playwright/test';
import { openStory, settle } from '../support';

const DEFAULT_ID = 'components-forms-dropzone--default';
const MULTIPLE_ID = 'components-forms-dropzone--multiple';
const FAILING_ID = 'components-forms-dropzone--failing-uploads';

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

interface DroppedFile {
  name: string;
  type: string;
  base64?: string;
}

const PHOTO: DroppedFile = { name: 'photo.png', type: 'image/png', base64: ONE_PIXEL_PNG };
const REPORT: DroppedFile = { name: 'report.pdf', type: 'application/pdf' };

function dataTransferWith(page: Page, files: DroppedFile[]) {
  return page.evaluateHandle((entries) => {
    const dataTransfer = new DataTransfer();

    for (const entry of entries) {
      const bytes = entry.base64 ? Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0)) : 'content';

      dataTransfer.items.add(new File([bytes], entry.name, { type: entry.type }));
    }

    return dataTransfer;
  }, files);
}

async function dragAndDrop(target: Locator, dataTransfer: JSHandle<DataTransfer>) {
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
}

async function dropFiles(page: Page, dropzone: Locator, files: DroppedFile[]) {
  await dragAndDrop(dropzone, await dataTransferWith(page, files));
}

function triggerPaint(trigger: Locator) {
  return trigger.evaluate((el) => {
    const style = getComputedStyle(el);

    return `${style.borderTopColor} ${style.backgroundColor}`;
  });
}

test.describe('dropzone / dropping files', () => {
  test('a dropped image fills the single preview with that image', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const dropzone = root.locator('et-dropzone');

    await dropFiles(page, dropzone, [PHOTO]);

    const image = root.locator('.et-dropzone-preview .et-dropzone-preview-image');

    await expect(image).toHaveAttribute('src', /^(blob|data):/);
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);
    await expect(root.locator('.et-dropzone-entry-name')).toHaveText('photo.png');
    await expect(dropzone).not.toHaveAttribute('data-drag-over');
  });

  test('several files dropped in multiple mode each get an item, a non-image a file icon', async ({ page }) => {
    const root = await openStory(page, MULTIPLE_ID);

    await dropFiles(page, root.locator('et-dropzone'), [PHOTO, REPORT]);

    const items = root.locator('.et-dropzone-item');

    await expect(items).toHaveCount(2);
    await expect(items.nth(0).locator('.et-dropzone-preview-image')).toHaveCount(1);
    await expect(items.nth(1).locator('.et-dropzone-preview-image')).toHaveCount(0);
    await expect(items.nth(1).locator('.et-dropzone-file-icon')).toBeVisible();
  });

  test('a drop onto a disabled dropzone does nothing', async ({ page }) => {
    const root = await openStory(page, MULTIPLE_ID, { args: { disabled: true } });
    const dropzone = root.locator('et-dropzone');

    await dropFiles(page, dropzone, [REPORT]);
    await settle(page, 150);

    await expect(dropzone).not.toHaveAttribute('data-drag-over');
    await expect(root.locator('.et-dropzone-item')).toHaveCount(0);
  });

  test('a drop the size rule refuses is reported, not added', async ({ page }) => {
    const root = await openStory(page, MULTIPLE_ID, { args: { maxFileSize: 20 } });

    await dropFiles(page, root.locator('et-dropzone'), [PHOTO]);

    await expect(root.locator('et-dropzone')).toContainText('"photo.png" is too large');
    await expect(root.locator('.et-dropzone-item')).toHaveCount(0);
  });
});

test.describe('dropzone / drag-over styling', () => {
  test('dragging files over tints the trigger, and leaving restores it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const dropzone = root.locator('et-dropzone');
    const trigger = root.locator('.et-dropzone-trigger');
    const idle = await triggerPaint(trigger);
    const dataTransfer = await dataTransferWith(page, [PHOTO]);

    await dropzone.dispatchEvent('dragenter', { dataTransfer });

    await expect.poll(() => triggerPaint(trigger)).not.toBe(idle);

    await dropzone.dispatchEvent('dragleave', { dataTransfer });

    await expect.poll(() => triggerPaint(trigger)).toBe(idle);
  });

  test('moving across the children inside keeps the state until the drag leaves the dropzone', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const dropzone = root.locator('et-dropzone');
    const prompt = root.locator('.et-dropzone-prompt');
    const dataTransfer = await dataTransferWith(page, [PHOTO]);

    await dropzone.dispatchEvent('dragenter', { dataTransfer });
    await prompt.dispatchEvent('dragenter', { dataTransfer });
    await dropzone.dispatchEvent('dragleave', { dataTransfer });

    await expect(dropzone).toHaveAttribute('data-drag-over', 'true');

    await prompt.dispatchEvent('dragleave', { dataTransfer });

    await expect(dropzone).not.toHaveAttribute('data-drag-over');
  });

  test('a drag carrying no files is not offered as a drop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const dropzone = root.locator('et-dropzone');
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();

      transfer.setData('text/plain', 'just text');

      return transfer;
    });

    await dropzone.dispatchEvent('dragenter', { dataTransfer });
    await settle(page, 100);

    await expect(dropzone).not.toHaveAttribute('data-drag-over');
  });
});

test.describe('dropzone / upload progress', () => {
  test('an upload shows a filling progress bar that folds away once done', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await dropFiles(page, root.locator('et-dropzone'), [PHOTO]);

    const progress = root.locator('.et-dropzone-entry-progress');
    const bar = progress.locator('et-progress-bar');
    const valueNow = async () => Number(await bar.getAttribute('aria-valuenow'));

    await expect(progress).toHaveAttribute('data-active', 'true');
    await expect(progress).toHaveCSS('opacity', '1');
    await expect.poll(valueNow).toBeGreaterThan(0);

    const early = await valueNow();

    await expect.poll(valueNow).toBeGreaterThan(early);
    await expect(progress).not.toHaveAttribute('data-active', { timeout: 10_000 });
    await expect(progress).toHaveCSS('opacity', '0');
    await expect(root.locator('.et-dropzone-preview')).toHaveAttribute('data-status', 'success');
  });

  test('a failed upload offers a retry that succeeds', async ({ page }) => {
    const root = await openStory(page, FAILING_ID);

    await dropFiles(page, root.locator('et-dropzone'), [REPORT]);

    const preview = root.locator('.et-dropzone-preview');
    const retry = root.locator('.et-dropzone-retry-button');

    await expect(preview).toHaveAttribute('data-status', 'error', { timeout: 10_000 });
    await expect(retry).toBeVisible();

    await retry.click();

    await expect(preview).toHaveAttribute('data-status', 'success', { timeout: 10_000 });
    await expect(retry).toHaveCount(0);
  });
});

test.describe('dropzone / removing', () => {
  test('removing the single entry brings the trigger back as the tab stop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const trigger = root.locator('.et-dropzone-trigger');

    await dropFiles(page, root.locator('et-dropzone'), [PHOTO]);
    await expect(trigger).toHaveAttribute('tabindex', '-1');

    await root.locator('.et-dropzone-remove-button').click();

    await expect(root.locator('.et-dropzone-preview')).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('tabindex');
  });

  test('removing an item keeps the others and they close the gap', async ({ page }) => {
    const root = await openStory(page, MULTIPLE_ID);
    const items = root.locator('.et-dropzone-item');

    await dropFiles(page, root.locator('et-dropzone'), [PHOTO, REPORT, { ...REPORT, name: 'notes.pdf' }]);
    await expect(items).toHaveCount(3);

    const offsetTop = () => items.first().evaluate((el) => (el as HTMLElement).offsetTop);
    const firstTop = await offsetTop();

    await items.first().locator('.et-dropzone-remove-button').click();

    await expect(items).toHaveCount(2);
    await expect(root.locator('.et-dropzone-entry-name')).toHaveText(['report.pdf', 'notes.pdf']);
    await expect.poll(offsetTop).toBe(firstTop);
  });
});
