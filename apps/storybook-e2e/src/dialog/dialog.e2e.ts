import { CDPSession, Page, expect, test } from '@playwright/test';
import { openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-overlays-overlay--default';

const DIALOG_ROOT = '[role="dialog"]';
const BACKDROP = '.et-overlay-runtime-backdrop';
const PANE = '.et-overlay';

async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator(PANE)).toHaveClass(/et-animation-enter-done/);
}

async function touchSwipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> {
  const client: CDPSession = await page.context().newCDPSession(page);

  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });

  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;

    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }

  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('no viewport size');

    await page.locator(BACKDROP).tap({ position: { x: viewport.width / 2, y: 4 } });
    await page.waitForTimeout(50);

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
    const box = await pane.boundingBox();
    if (!box) throw new Error('bottom sheet pane has no bounding box');

    const startX = box.x + box.width / 2;
    const startY = box.y + 12;

    await touchSwipe(page, { x: startX, y: startY }, { x: startX, y: startY + 260 });

    await expect(page.locator(DIALOG_ROOT)).toHaveCount(0);
  });
});
