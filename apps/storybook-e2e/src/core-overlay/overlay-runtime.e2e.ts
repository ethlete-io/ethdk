import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, tap, viewportOf } from '../support';

const MODAL_STORY_ID = 'core-overlay-runtime--modal';
const POPOVER_STORY_ID = 'core-overlay-runtime--popover';

const PADDING = 24;

const pane = (page: Page, label: string) =>
  page.getByRole('dialog', { name: label }).locator('.et-overlay-runtime-pane');

async function waitForEntered(paneLocator: Locator): Promise<void> {
  await expect(paneLocator).toHaveClass(/et-animation-enter-done/);
}

async function expectInsidePadding(page: Page, paneLocator: Locator): Promise<void> {
  const viewport = viewportOf(page);

  await expect
    .poll(async () => {
      const box = await boxOf(paneLocator);

      return (
        box.x >= PADDING &&
        box.y >= PADDING &&
        box.x + box.width <= viewport.width - PADDING &&
        box.y + box.height <= viewport.height - PADDING
      );
    })
    .toBe(true);
}

async function expectBelow(paneLocator: Locator, reference: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const paneBox = await boxOf(paneLocator);
      const referenceBox = await boxOf(reference);

      return paneBox.y >= referenceBox.y + referenceBox.height;
    })
    .toBe(true);
}

async function expectAbove(paneLocator: Locator, reference: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const paneBox = await boxOf(paneLocator);
      const referenceBox = await boxOf(reference);

      return paneBox.y + paneBox.height <= referenceBox.y;
    })
    .toBe(true);
}

test.describe('core overlay runtime / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus handling');

  test('autoFocus false leaves focus on the trigger until Tab moves it into the modal', async ({ page }) => {
    const root = await openStory(page, MODAL_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Open modal' });

    await trigger.click();
    await waitForEntered(pane(page, 'Modal dialog'));

    await expect(trigger).toBeFocused();

    await pressKey(page, 'Tab');

    await expect(
      page.getByRole('dialog', { name: 'Modal dialog' }).getByRole('textbox', { name: 'Name' }),
    ).toBeFocused();
  });

  test('Escape closes the modal and returns focus to the trigger', async ({ page }) => {
    const root = await openStory(page, MODAL_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Open modal' });

    await trigger.click();
    await waitForEntered(pane(page, 'Modal dialog'));
    await pressKey(page, 'Tab');

    await pressKey(page, 'Escape');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Escape closes stacked dialogs top first and restores focus at each step', async ({ page }) => {
    const root = await openStory(page, MODAL_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Open modal' });
    const modal = page.getByRole('dialog', { name: 'Modal dialog' });
    const stacked = page.getByRole('dialog', { name: 'Stacked dialog' });
    const stackTrigger = modal.getByRole('button', { name: 'Open stacked dialog' });

    await trigger.click();
    await waitForEntered(pane(page, 'Modal dialog'));
    await stackTrigger.click();
    await waitForEntered(pane(page, 'Stacked dialog'));

    await expect(stacked.getByRole('textbox', { name: 'Name' })).toBeFocused();

    await pressKey(page, 'Escape');

    await expect(stacked).toHaveCount(0);
    await expect(modal).toBeVisible();
    await expect(stackTrigger).toBeFocused();

    await pressKey(page, 'Escape');

    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Tab stays trapped in the top-most of two stacked dialogs', async ({ page }) => {
    const root = await openStory(page, MODAL_STORY_ID);
    const stacked = page.getByRole('dialog', { name: 'Stacked dialog' });

    await root.getByRole('button', { name: 'Open modal' }).click();
    await waitForEntered(pane(page, 'Modal dialog'));
    await page.getByRole('button', { name: 'Open stacked dialog' }).click();
    await waitForEntered(pane(page, 'Stacked dialog'));

    await pressKey(page, 'Tab');
    await expect(stacked.getByRole('button', { name: 'Close' })).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(stacked.getByRole('textbox', { name: 'Name' })).toBeFocused();
  });
});

test.describe('core overlay runtime / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('tapping Close in the stacked dialog leaves the modal below it open', async ({ page }) => {
    const root = await openStory(page, MODAL_STORY_ID);
    const modal = page.getByRole('dialog', { name: 'Modal dialog' });
    const stacked = page.getByRole('dialog', { name: 'Stacked dialog' });

    await tap(root.getByRole('button', { name: 'Open modal' }));
    await waitForEntered(pane(page, 'Modal dialog'));
    await tap(modal.getByRole('button', { name: 'Open stacked dialog' }));
    await waitForEntered(pane(page, 'Stacked dialog'));

    await tap(stacked.getByRole('button', { name: 'Close' }));

    await expect(stacked).toHaveCount(0);
    await expect(modal).toBeVisible();
  });
});

test.describe('core overlay runtime / anchored popover', () => {
  test('a popover opened at the viewport edge lays out inside the viewport padding', async ({ page }) => {
    const root = await openStory(page, POPOVER_STORY_ID);

    await root.getByRole('button', { name: 'Open popover' }).click();

    await expectInsidePadding(page, pane(page, 'Popover'));
  });

  test('a popover opened at the right edge keeps its top placement and shifts left', async ({ page }) => {
    const root = await openStory(page, POPOVER_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Open popover' });
    const popover = pane(page, 'Popover');

    await trigger.click();
    await waitForEntered(popover);

    await expectAbove(popover, trigger);
    await expectInsidePadding(page, popover);
  });

  test('a scroll that moves the trigger to the top edge flips the popover below it, inside the padding', async ({
    page,
  }) => {
    const root = await openStory(page, POPOVER_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Open popover' });
    const popover = pane(page, 'Popover');

    await trigger.click();
    await waitForEntered(popover);

    const triggerBox = await boxOf(trigger);
    await page.evaluate((top) => window.scrollBy(0, top), triggerBox.y - 40);

    await expectBelow(popover, trigger);
    await expectInsidePadding(page, popover);
  });

  test('a narrower viewport moves the open popover back inside the padding', async ({ page }) => {
    const root = await openStory(page, POPOVER_STORY_ID);
    const popover = pane(page, 'Popover');

    await root.getByRole('button', { name: 'Open popover' }).click();
    await waitForEntered(popover);

    await page.setViewportSize({ width: 400, height: viewportOf(page).height });

    await expectInsidePadding(page, popover);
  });
});
