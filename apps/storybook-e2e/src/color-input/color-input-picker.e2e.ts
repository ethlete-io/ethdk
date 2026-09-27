import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, tap, touchDrag } from '../support';

const DEFAULT_ID = 'components-forms-color-input--default';
const PINNED_NOTATION_ID = 'components-forms-color-input--pinned-notation';
const PICKED_COLOR = '#12ab34';

const trigger = (root: Locator) => root.locator('.et-color-input-trigger');
const panel = (page: Page) => page.getByRole('dialog', { name: 'Choose a color' });
const area = (page: Page) => panel(page).locator('[etColorPickerArea]');
const channelValue = async (page: Page, name: string) =>
  Number(await panel(page).getByLabel(name, { exact: true }).inputValue());
const eyedropper = (page: Page) => panel(page).locator('.et-color-picker-eyedropper');

async function activate(target: Locator, isMobile: boolean) {
  await (isMobile ? tap(target) : target.click());
}

async function openPicker(page: Page, root: Locator, isMobile: boolean) {
  await activate(trigger(root), isMobile);
  await expect(page.locator('.et-color-input-overlay-pane')).toHaveClass(/et-animation-enter-done/);
}

async function stubEyeDropper(page: Page, outcome: 'pick' | 'cancel' | 'absent') {
  await page.addInitScript(
    ({ mode, color }) => {
      if (mode === 'absent') {
        delete (window as { EyeDropper?: unknown }).EyeDropper;

        return;
      }

      (window as { EyeDropper?: unknown }).EyeDropper = class {
        open() {
          return mode === 'pick'
            ? Promise.resolve({ sRGBHex: color })
            : Promise.reject(new DOMException('The user canceled the selection.', 'AbortError'));
        }
      };
    },
    { mode: outcome, color: PICKED_COLOR },
  );
}

async function expectThumbAt(page: Page, x: number, y: number) {
  const thumb = await boxOf(area(page).locator('.et-color-picker-area-thumb'));

  expect(Math.abs(thumb.x + thumb.width / 2 - x)).toBeLessThanOrEqual(2);
  expect(Math.abs(thumb.y + thumb.height / 2 - y)).toBeLessThanOrEqual(2);
}

test.describe('color-input picker / area drag', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('a press on the area picks the color under the pointer at once', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPicker(page, root, false);

    const box = await boxOf(area(page));
    const x = box.x + box.width * 0.25;
    const y = box.y + box.height * 0.75;

    await page.mouse.click(x, y);

    await expect.poll(() => channelValue(page, 'Saturation')).toBe(25);
    await expect.poll(() => channelValue(page, 'Brightness')).toBe(25);
    await expectThumbAt(page, x, y);
    await expect(trigger(root)).not.toContainText('#3366ff');
  });

  test('dragging moves the thumb with the pointer and commits live', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPicker(page, root, false);

    const box = await boxOf(area(page));

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1, { steps: 8 });

    await expect.poll(() => channelValue(page, 'Saturation')).toBe(90);
    await expect.poll(() => channelValue(page, 'Brightness')).toBe(90);

    const midDrag = await trigger(root).innerText();

    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.9, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => channelValue(page, 'Saturation')).toBe(10);
    await expect.poll(() => channelValue(page, 'Brightness')).toBe(10);
    await expect(trigger(root)).not.toHaveText(midDrag);
    await expect(panel(page)).toBeVisible();
  });

  test('a drag past the edge of the area clamps to the edge', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPicker(page, root, false);

    const box = await boxOf(area(page));

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 60, box.y - 60, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => channelValue(page, 'Saturation')).toBe(100);
    await expect.poll(() => channelValue(page, 'Brightness')).toBe(100);
    await expect(panel(page)).toBeVisible();
  });

  test('the anchored panel opens right under the field, start edges aligned', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await openPicker(page, root, false);

    const field = await boxOf(root.locator('.et-form-field-control-frame'));
    const pane = await boxOf(page.locator('.et-color-input-overlay-pane'));

    expect(Math.abs(pane.x - field.x)).toBeLessThanOrEqual(1);
    expect(pane.y).toBeGreaterThanOrEqual(field.y + field.height);
    expect(pane.y - (field.y + field.height)).toBeLessThanOrEqual(12);
  });
});

test.describe('color-input picker / area drag on touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: finger drag');

  test('a finger drag across the area moves the color with it', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPicker(page, root, true);

    const box = await boxOf(area(page));

    await touchDrag(
      page,
      { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.2, y: box.y + box.height * 0.8 },
    );

    await expect.poll(() => channelValue(page, 'Saturation')).toBe(20);
    await expect.poll(() => channelValue(page, 'Brightness')).toBe(20);
    await expect(panel(page)).toBeVisible();
  });

  test('the area claims the gesture instead of scrolling the sheet', async ({ page }) => {
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPicker(page, root, true);

    await expect(area(page)).toHaveCSS('touch-action', 'none');
  });
});

test.describe('color-input picker / eyedropper', () => {
  test('a picked screen color is committed to the field', async ({ isMobile, page }) => {
    await stubEyeDropper(page, 'pick');
    const root = await openStory(page, DEFAULT_ID);

    await openPicker(page, root, isMobile);
    await activate(eyedropper(page), isMobile);

    await expect(trigger(root)).toContainText(PICKED_COLOR);
  });

  test('a cancelled pick leaves the color as it was', async ({ isMobile, page }) => {
    await stubEyeDropper(page, 'cancel');
    const root = await openStory(page, PINNED_NOTATION_ID);

    await openPicker(page, root, isMobile);
    await activate(eyedropper(page), isMobile);

    await expect(panel(page)).toBeVisible();
    await expect(trigger(root)).toContainText('#3366ff');
  });

  test('a browser without the EyeDropper API gets no button', async ({ isMobile, page }) => {
    await stubEyeDropper(page, 'absent');
    const root = await openStory(page, DEFAULT_ID);

    await openPicker(page, root, isMobile);

    await expect(eyedropper(page)).toHaveCount(0);
  });

  test('the button is labelled for what it does', async ({ isMobile, page }) => {
    await stubEyeDropper(page, 'pick');
    const root = await openStory(page, DEFAULT_ID);

    await openPicker(page, root, isMobile);

    await expect(panel(page).getByRole('button', { name: 'Pick a color from the screen' })).toBeVisible();
  });
});
