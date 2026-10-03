import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, pressKeys, settle, tap } from '../support';

const STORY_ID = 'components-feedback-tooltip--default';
const EMPTY_TEXT_STORY_ID = 'components-feedback-tooltip--empty-text';
const IN_DIALOG_STORY_ID = 'components-feedback-tooltip-in-dialog--default';
const TOOLTIP_TEXT = 'A lightweight tooltip built on the new overlay primitives.';

/** Resolves the element `trigger`'s `aria-describedby` currently points at. */
async function describedByElement(trigger: Locator): Promise<Locator> {
  const id = (await trigger.getAttribute('aria-describedby')) ?? '';

  return trigger.page().locator(`#${id}`);
}

/** Gives the story room to scroll and puts `trigger` at the very top of the viewport. */
async function scrollToViewportTop(page: Page, trigger: Locator): Promise<void> {
  await page.evaluate(() => {
    document.body.style.paddingBottom = '300vh';
  });
  await trigger.evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

test.describe('tooltip / placement', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover triggers the tooltip');

  test('a tooltip that would cross the left edge shifts in and keeps its arrow on the trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });

    await trigger.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(page.locator('.et-tooltip-panel')).toHaveClass(/et-animation-enter-done/);

    const triggerBox = await boxOf(trigger);
    const tooltipBox = await boxOf(tooltip);
    const arrowBox = await boxOf(page.locator('.et-tooltip-panel .et-overlay-arrow'));

    expect(tooltipBox.width / 2).toBeGreaterThan(triggerBox.x + triggerBox.width / 2);
    expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
    expect(arrowBox.x + arrowBox.width / 2).toBeCloseTo(triggerBox.x + triggerBox.width / 2, 0);
  });

  test('a top tooltip with no room above its trigger flips below it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });

    await scrollToViewportTop(page, trigger);
    await trigger.hover();

    const panel = page.locator('.et-tooltip-panel');
    await expect(panel).toHaveAttribute('data-overlay-placement', 'bottom');

    const triggerBox = await boxOf(trigger);
    const tooltipBox = await boxOf(page.getByRole('tooltip'));

    expect(tooltipBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
  });

  test('a tooltip whose trigger scrolls out of view closes', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });

    await pressKey(page, 'Tab');
    await expect(trigger).toBeFocused();
    await scrollToViewportTop(page, trigger);
    await expect(page.getByRole('tooltip')).toBeVisible();

    await page.evaluate(() => window.scrollBy(0, 400));

    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});

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

  test('a tooltip inside a dialog paints above the dialog', async ({ page }) => {
    const root = await openStory(page, IN_DIALOG_STORY_ID);
    await root.getByRole('button', { name: 'Open dialog' }).click();
    await expect(page.locator('.et-overlay')).toHaveClass(/et-animation-enter-done/);

    await page.getByRole('button', { name: 'Tooltip inside the dialog' }).hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();

    await expect(tooltip).toHaveCSS('pointer-events', 'none');

    const box = await boxOf(tooltip);
    const hit = await page.evaluate(
      ({ x, y }) => {
        const probe = document.createElement('style');
        probe.textContent = '[role="tooltip"], [role="tooltip"] * { pointer-events: auto !important; }';
        document.head.append(probe);

        const topmost = document.elementFromPoint(x, y)?.closest('[role="tooltip"]') !== null;
        probe.remove();

        return topmost;
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );

    expect(hit).toBe(true);
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

test.describe('tooltip / empty text', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover and keyboard focus trigger the tooltip');

  test('hovering a trigger with an empty etTooltip opens nothing and adds no description', async ({ page }) => {
    const root = await openStory(page, EMPTY_TEXT_STORY_ID);
    const trigger = root.getByRole('button', { name: 'Text tooltip' });

    await trigger.hover();
    await settle(page, 400);

    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  test('focusing a trigger with an empty etTooltip opens nothing', async ({ page }) => {
    const root = await openStory(page, EMPTY_TEXT_STORY_ID);

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Text tooltip' })).toBeFocused();
    await settle(page, 400);

    await expect(page.getByRole('tooltip')).toHaveCount(0);
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

test.describe('tooltip / chrome', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover trigger');

  test('the content root does not clip the panel shadow to a square', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await root.getByRole('button', { name: 'Text tooltip' }).hover();

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveCSS('overflow', 'visible');
  });
});
