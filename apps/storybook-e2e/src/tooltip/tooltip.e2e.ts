import { Locator, expect, test } from '@playwright/test';
import { openStory, pressKey, pressKeys, settle, tap } from '../support';

const STORY_ID = 'components-feedback-tooltip--default';
const IN_DIALOG_STORY_ID = 'components-feedback-tooltip-in-dialog--default';
const TOOLTIP_TEXT = 'A lightweight tooltip built on the new overlay primitives.';

/** Resolves the element `trigger`'s `aria-describedby` currently points at. */
async function describedByElement(trigger: Locator): Promise<Locator> {
  const id = (await trigger.getAttribute('aria-describedby')) ?? '';

  return trigger.page().locator(`#${id}`);
}

test.describe('tooltip / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover and keyboard-focus triggers');

  test('hovering the trigger shows the tooltip after the show delay and hides it on leave', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });
    const tooltip = page.getByRole('tooltip');

    await trigger.hover();

    await expect(tooltip).not.toBeVisible({ timeout: 150 });
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(TOOLTIP_TEXT);

    await page.mouse.move(0, 0);

    await expect(tooltip).toBeHidden();
  });

  test('keyboard focus shows the tooltip immediately and blur hides it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(trigger).toBeFocused();

    await expect(tooltip).toBeVisible({ timeout: 150 });

    await trigger.evaluate((el) => el.blur());

    await expect(tooltip).toBeHidden();
  });

  test('aria-describedby links the trigger to the tooltip content, open or closed', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });

    const idleDescription = await describedByElement(trigger);
    await expect(idleDescription).toHaveText(TOOLTIP_TEXT);

    await trigger.hover();
    await expect(page.getByRole('tooltip')).toBeVisible();

    const openDescription = await describedByElement(trigger);
    await expect(openDescription).toHaveText(TOOLTIP_TEXT);
  });
});

test.describe('tooltip / inside a dialog', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover triggers the tooltip');

  test('a backdrop press closes the dialog while a tooltip is shown inside it', async ({ page }) => {
    const root = await openStory(page, IN_DIALOG_STORY_ID);
    await root.getByRole('button', { name: 'Open dialog' }).click();

    const dialog = page.getByRole('dialog');
    await expect(page.locator('.et-overlay')).toHaveClass(/et-animation-enter-done/);

    const tooltipTrigger = page.getByRole('button', { name: 'Tooltip inside the dialog' });
    await expect(tooltipTrigger).toBeFocused();
    await pressKeys(page, ['Tab', 'Tab']);
    await expect(tooltipTrigger).toBeFocused();
    await expect(page.getByRole('tooltip')).toBeVisible();

    await page.locator('.et-overlay-runtime-backdrop').click({ position: { x: 5, y: 5 } });

    await expect(dialog).toHaveCount(0);
  });

  test('Escape hides the tooltip first and closes the dialog next', async ({ page }) => {
    const root = await openStory(page, IN_DIALOG_STORY_ID);
    await root.getByRole('button', { name: 'Open dialog' }).click();

    const dialog = page.getByRole('dialog');
    await expect(page.locator('.et-overlay')).toHaveClass(/et-animation-enter-done/);

    await page.getByRole('button', { name: 'Tooltip inside the dialog' }).hover();
    await expect(page.getByRole('tooltip')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(dialog).toHaveCount(0);
  });
});

test.describe('tooltip / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard-focus triggers the tooltip');

  test('Escape hides an open tooltip', async ({ page }) => {
    await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(tooltip).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(tooltip).toBeHidden();
  });
});

test.describe('tooltip / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap does not trigger hover');

  test('a tap on the trigger does not leave a stuck tooltip', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });

    await tap(trigger);
    await settle(page, 400);

    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});
