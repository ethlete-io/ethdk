import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, pressKeys, tap } from '../support';

const DEFAULT_STORY_ID = 'components-feedback-toggletip--default';
const BOTTOM_STORY_ID = 'components-feedback-toggletip--bottom';
const RIGHT_STORY_ID = 'components-feedback-toggletip--right';

/** The overlay arms its outside-pointer close only after the enter transition. Wait before you click outside. */
async function waitForPanelEntered(dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await dialog
    .locator('.et-toggletip-panel')
    .evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))),
    );
}

test.describe('toggletip / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: click and outside-click behavior');

  test('Tab reaches the trigger and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });

    await pressKey(page, 'Tab');

    await expectFocusVisible(trigger);
  });

  test('a click on the trigger opens the toggletip and sets its aria attributes', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });

    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-controls', /.+/);

    const controlsId = await trigger.getAttribute('aria-controls');
    await expect(page.locator(`#${controlsId}`)).toBeVisible();
  });

  test('a second click on the trigger toggles the toggletip closed', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });

    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await trigger.click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('a click outside the open toggletip closes it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });
    const dialog = page.getByRole('dialog');

    await trigger.click();
    await waitForPanelEntered(dialog);

    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await expect(dialog).toBeHidden();
  });

  test('the toggletip overlay renders outside the story root', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });

    await trigger.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(root.getByRole('dialog')).toHaveCount(0);
  });

  test('etToggletipClose on a button inside the content closes it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Interactive toggletip' });

    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  for (const storyId of [BOTTOM_STORY_ID, RIGHT_STORY_ID]) {
    test(`the panel is anchored to the trigger for story "${storyId}"`, async ({ page }) => {
      const root = await openStory(page, storyId);
      const trigger = root.getByRole('button', { name: 'Text toggletip' });

      await trigger.click();

      await expect(page.locator('.et-toggletip-panel')).toHaveAttribute(
        'data-overlay-placement',
        /^(top|right|bottom|left)/,
      );
      await expect(page.locator('.et-overlay-arrow')).toHaveCount(1);
    });
  }
});

test.describe('toggletip / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard interaction');

  test('Enter on the trigger opens the toggletip and moves focus to its first tabbable element', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const interactiveTrigger = root.getByRole('button', { name: 'Interactive toggletip' });

    await pressKeys(page, ['Tab', 'Tab']);
    await expect(interactiveTrigger).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Secondary Action' })).toBeFocused();
  });

  test('Space on the trigger opens the toggletip', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });

    await pressKey(page, 'Tab');
    await pressKey(page, ' ');

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('Escape closes the toggletip and restores focus to the trigger', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const interactiveTrigger = root.getByRole('button', { name: 'Interactive toggletip' });

    await pressKeys(page, ['Tab', 'Tab']);
    await pressKey(page, 'Enter');
    await expect(page.getByRole('button', { name: 'Secondary Action' })).toBeFocused();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(interactiveTrigger).toBeFocused();
  });
});

test.describe('toggletip / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the trigger opens the toggletip', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });

    await tap(trigger);

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('a tap outside the open toggletip closes it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text toggletip' });
    const dialog = page.getByRole('dialog');

    await tap(trigger);
    await waitForPanelEntered(dialog);

    await page.locator('body').tap({ position: { x: 5, y: 5 } });

    await expect(dialog).toBeHidden();
  });
});
