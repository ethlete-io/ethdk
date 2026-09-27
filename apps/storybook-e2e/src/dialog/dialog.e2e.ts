import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, tap, touchSwipe, viewportOf } from '../support';

const STORY_ID = 'components-overlays-overlay--default';

const DIALOG_ROOT = '[role="dialog"]';
const BACKDROP = '.et-overlay-runtime-backdrop';
const PANE = '.et-overlay';

const ORIGIN_CLONE = 'et-overlay-origin-clone';
const FULL_SCREEN_DOCUMENT = /et-overlay--full-screen-dialog-document/;

async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator(PANE)).toHaveClass(/et-animation-enter-done/);
}

async function expectPaneCoversViewport(page: Page): Promise<void> {
  const viewport = viewportOf(page);

  await expect
    .poll(async () => {
      const box = await boxOf(page.locator(PANE));

      return [box.x, box.y, box.width, box.height].map(Math.round);
    })
    .toEqual([0, 0, viewport.width, viewport.height]);
  await expect(page.locator(PANE)).toHaveCSS('transform', 'none');
}

async function expectOriginRestored(page: Page, origin: Locator): Promise<void> {
  await expect(page.locator(ORIGIN_CLONE)).toHaveCount(0);
  await expect(origin).toHaveCSS('opacity', '1');
  await expect(origin).not.toHaveAttribute('data-et-origin-hidden-count');
  await expect(page.locator('html')).not.toHaveClass(FULL_SCREEN_DOCUMENT);
}

test.describe('dialog / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('opening the dialog moves focus to the first tabbable element and sets dialog ARIA', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await root.getByRole('button', { name: 'Dialog', exact: true }).click();

    const cancelButton = page.locator(PANE).getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeFocused();

    const dialogRoot = page.locator(DIALOG_ROOT);
    await expect(dialogRoot).toHaveAttribute('aria-modal', 'true');
  });

  test('Escape closes the dialog and returns focus to the element that opened it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Dialog', exact: true });
    await trigger.click();

    await waitForEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('a press that opens a dialog keeps focus there while an anchored popover closes', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const popoverTrigger = root.getByRole('button', { name: 'Anchored popover' });
    const dialogTrigger = root.getByRole('button', { name: 'Dialog', exact: true });

    await popoverTrigger.click();
    await waitForEntered(page);

    await dialogTrigger.click();

    await expect(page.locator(PANE)).toHaveCount(1);
    await expect(page.locator(PANE).getByRole('button', { name: 'Cancel' })).toBeFocused();
  });

  test('a click on the backdrop closes the dialog', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await root.getByRole('button', { name: 'Dialog', exact: true }).click();

    await waitForEntered(page);

    await page.locator(BACKDROP).click({ position: { x: 5, y: 5 } });

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
  });

  test('body scroll is locked while the dialog is open and restored after close', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '3000px';
      document.body.appendChild(spacer);
    });

    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).position)).not.toBe('fixed');

    await root.getByRole('button', { name: 'Dialog', exact: true }).click();
    await waitForEntered(page);

    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).position)).toBe('fixed');

    await pressKey(page, 'Escape');

    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).position)).not.toBe('fixed');
  });
});

test.describe('dialog / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: focus trap navigation');

  test('Tab cycles through the pane and wraps from the last tabbable element back to the first', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await root.getByRole('button', { name: 'Dialog', exact: true }).click();

    const pane = page.locator(PANE);
    const cancelButton = pane.getByRole('button', { name: 'Cancel' });
    const confirmButton = pane.getByRole('button', { name: 'Confirm' });

    await expect(cancelButton).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(confirmButton).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(cancelButton).toBeFocused();
  });

  test('Shift+Tab wraps from the first tabbable element to the last', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await root.getByRole('button', { name: 'Dialog', exact: true }).click();

    const pane = page.locator(PANE);
    const cancelButton = pane.getByRole('button', { name: 'Cancel' });
    const confirmButton = pane.getByRole('button', { name: 'Confirm' });

    await expect(cancelButton).toBeFocused();

    await pressKey(page, 'Shift+Tab');
    await expect(confirmButton).toBeFocused();
  });
});

test.describe('dialog / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap dismissal and drag-to-dismiss');

  test('a tap on the backdrop closes the dialog', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await tap(root.getByRole('button', { name: 'Dialog', exact: true }));

    await waitForEntered(page);

    const viewport = viewportOf(page);

    await page.locator(BACKDROP).tap({ position: { x: viewport.width / 2, y: 4 } });

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
  });

  test('a tap on the close control closes the dialog', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await tap(root.getByRole('button', { name: 'Dialog', exact: true }));

    const pane = page.locator(PANE);
    const cancelButton = pane.getByRole('button', { name: 'Cancel' });

    await waitForEntered(page);

    await tap(cancelButton);

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
  });

  test('a downward drag past the dismiss threshold closes the bottom sheet', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    await tap(root.getByRole('button', { name: 'Bottom sheet', exact: true }));

    await waitForEntered(page);

    const pane = page.locator(PANE);
    const box = await boxOf(pane);

    const startX = box.x + box.width / 2;
    const startY = box.y + 12;

    await touchSwipe(page, { x: startX, y: startY }, { x: startX, y: startY + 260 });

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
  });
});

test.describe('dialog / full-screen', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: viewport sizes are set per test');

  test('on a narrow viewport the pane grows out of its trigger, which stays hidden until the close', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Full-screen dialog' });

    await trigger.click();
    await waitForEntered(page);

    await expectPaneCoversViewport(page);
    await expect(page.locator(ORIGIN_CLONE)).toHaveAttribute('inert', 'true');
    await expect(trigger).toHaveCSS('opacity', '0');
    await expect(page.locator('html')).toHaveClass(FULL_SCREEN_DOCUMENT);
    await expect(page.locator(PANE).getByRole('button', { name: 'Cancel' })).toBeFocused();

    await pressKey(page, 'Escape');

    await expect(page.locator(PANE)).toHaveCount(0);
    await expectOriginRestored(page, trigger);
    await expect(trigger).toBeFocused();
  });

  test('on a wide viewport the pane fills the viewport without cloning or hiding its trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Full-screen dialog' });

    await trigger.click();
    await waitForEntered(page);

    await expectPaneCoversViewport(page);
    await expect(page.locator(ORIGIN_CLONE)).toHaveCount(0);
    await expect(trigger).toHaveCSS('opacity', '1');

    await pressKey(page, 'Escape');

    await expect(page.locator(PANE)).toHaveCount(0);
    await expectOriginRestored(page, trigger);
  });

  test('a transforming dialog turns full-screen below its breakpoint and back, and its trigger reappears after the close', async ({
    page,
  }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Full-screen → dialog' });

    await trigger.click();
    await waitForEntered(page);
    await expect(page.locator(PANE)).toHaveClass(/et-overlay--dialog/);
    const dialogBox = await boxOf(page.locator(PANE));

    await page.setViewportSize({ width: 500, height: 720 });
    await expect(page.locator(PANE)).toHaveClass(/et-overlay--full-screen-dialog/);
    await expectPaneCoversViewport(page);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator(PANE)).toHaveClass(/et-overlay--dialog/);
    await expect
      .poll(async () => Math.round((await boxOf(page.locator(PANE))).width))
      .toBe(Math.round(dialogBox.width));
    await expect(page.locator('html')).not.toHaveClass(FULL_SCREEN_DOCUMENT);
    await expect(page.locator(ORIGIN_CLONE)).toHaveCount(0);
    await expect(trigger).toHaveCSS('opacity', '1');
    await expect(page.locator(PANE).getByRole('button', { name: 'Cancel' })).toBeFocused();

    await pressKey(page, 'Escape');

    await expect(page.locator(PANE)).toHaveCount(0);
    await expectOriginRestored(page, trigger);
    await expect(trigger).toBeFocused();
  });

  test('a transforming dialog closed while full-screen restores its trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Full-screen → right sheet' });

    await trigger.click();
    await waitForEntered(page);
    await expect(page.locator(PANE)).toHaveClass(/et-overlay--right-sheet/);

    await page.setViewportSize({ width: 500, height: 720 });
    await expect(page.locator(PANE)).toHaveClass(/et-overlay--full-screen-dialog/);

    await pressKey(page, 'Escape');

    await expect(page.locator(PANE)).toHaveCount(0);
    await expectOriginRestored(page, trigger);
    await expect(trigger).toBeFocused();
  });
});

test.describe('dialog / full-screen touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap to open and close');

  test('a tapped full-screen dialog covers the screen and a tap on Cancel brings its trigger back', async ({
    page,
  }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Full-screen dialog' });

    await tap(trigger);
    await waitForEntered(page);

    await expectPaneCoversViewport(page);
    await expect(trigger).toHaveCSS('opacity', '0');

    await tap(page.locator(PANE).getByRole('button', { name: 'Cancel' }));

    await expect(page.locator(PANE)).toHaveCount(0);
    await expectOriginRestored(page, trigger);
  });
});
