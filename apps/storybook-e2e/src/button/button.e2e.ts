import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, countClicks, expectFocusVisible, openStory, pressKey, settle, tabUntilFocused, tap } from '../support';

const STORY_ID = 'components-actions-button-surface--default';

test.describe('button / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the button and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(button);
  });

  test('a disabled button is skipped in the tab order', async ({ page }) => {
    await openStory(page, STORY_ID, { args: { disabled: true } });

    await pressKey(page, 'Tab');

    const activeTag = await page.evaluate(() => document.activeElement?.tagName);

    expect(activeTag).toBe('BODY');
  });
});

test.describe('button / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Space activates the focused button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await button.focus();
    await countClicks(button);

    await pressKey(page, 'Space');

    await expect(button).toHaveJSProperty('__clicks', 1);
  });

  test('Enter activates the focused button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await button.focus();
    await countClicks(button);

    await pressKey(page, 'Enter');

    await expect(button).toHaveJSProperty('__clicks', 1);
  });

  test('a loading button stays focusable but its click is blocked', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { loading: true } });
    const button = root.locator('button[et-button]').first();

    await pressKey(page, 'Tab');

    await expect(button).toBeFocused();

    await countClicks(button);

    await pressKey(page, 'Enter');

    await expect(button).toHaveJSProperty('__clicks', 0);
  });
});

test.describe('button / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('a tap activates the button on a touch device', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await countClicks(button);

    await tap(button);

    await expect(button).toHaveJSProperty('__clicks', 1);
  });
});

const ICON_STORY_ID = 'components-actions-button-icon--default';
const FAB_STORY_ID = 'components-actions-button-fab--default';
const WINDOW_CONTROL_STORY_ID = 'components-actions-button-window-control--default';
const CHECKBOX_STORY_ID = 'components-forms-checkbox--default';

async function backgroundOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

async function transformOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).transform);
}

async function focusRingStyleMounted(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('style')).some((style) =>
      style.textContent?.includes('.et-focus-ring:focus-visible'),
    ),
  );
}

test.describe('button / focus ring per kind', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  for (const [kind, id, selector] of [
    ['icon', ICON_STORY_ID, 'button[et-icon-button]'],
    ['fab', FAB_STORY_ID, 'button[et-fab]'],
    ['window-control', WINDOW_CONTROL_STORY_ID, 'button[et-window-control-button]'],
  ] as const) {
    test(`Tab reaches the first ${kind} button and the focus ring is visible`, async ({ page }) => {
      const root = await openStory(page, id);

      await pressKey(page, 'Tab');

      await expectFocusVisible(root.locator(selector).first());
    });
  }
});

test.describe('button / pressed toggle', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('a pressed toggle announces aria-pressed and swaps to its pressed variant', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { pressed: true } });
    const button = root.locator('button[et-button][data-variant="filled"]').first();

    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toHaveAttribute('data-pressed-variant', 'outline');
  });

  test('an unpressed toggle announces aria-pressed="false" and keeps its own variant colours', async ({ page }) => {
    const pressedRoot = await openStory(page, STORY_ID, { args: { pressed: true } });
    const pressedBackground = await backgroundOf(pressedRoot.locator('button[et-button]').first());

    const root = await openStory(page, STORY_ID, { args: { pressed: false } });
    const button = root.locator('button[et-button]').first();

    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).not.toHaveAttribute('data-pressed-variant');
    expect(await backgroundOf(button)).not.toBe(pressedBackground);
  });

  test('Space on a toggle fires one click for the consumer to flip the state', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { pressed: false } });
    const button = root.locator('button[et-button]').first();

    await pressKey(page, 'Tab');
    await countClicks(button);

    await pressKey(page, 'Space');

    await expect(button).toHaveJSProperty('__clicks', 1);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('button / interaction colours', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hover and press each change the background of a filled button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();
    const rest = await backgroundOf(button);
    const box = await boxOf(button);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => backgroundOf(button)).not.toBe(rest);
    const hovered = await backgroundOf(button);

    await page.mouse.down();
    await expect.poll(() => backgroundOf(button)).not.toBe(hovered);

    await page.mouse.up();
    await page.mouse.move(0, 0);
    await expect.poll(() => backgroundOf(button)).toBe(rest);
  });

  test('a disabled button ignores hover', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { disabled: true } });
    const button = root.locator('button[et-button]').first();
    const rest = await backgroundOf(button);

    const box = await boxOf(button);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await settle(page, 250);

    expect(await backgroundOf(button)).toBe(rest);
  });
});

test.describe('button / focus ring press state', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  for (const [name, key] of [
    ['Enter', 'Enter'],
    ['Space', ' '],
  ] as const) {
    test(`holding ${name} marks the focused button active until the key is released`, async ({ page }) => {
      const root = await openStory(page, STORY_ID);
      const button = root.locator('button[et-button]').first();

      await pressKey(page, 'Tab');
      await page.keyboard.down(key);

      await expect(button).toHaveClass(/et-focus-ring--active/);
      await expectFocusVisible(button);

      await page.keyboard.up(key);

      await expect(button).not.toHaveClass(/et-focus-ring--active/);
    });
  }

  test('the shared focus ring stylesheet is injected and paints the ring', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    expect(await focusRingStyleMounted(page)).toBe(true);
    await expect(button).toHaveClass(/et-focus-ring/);

    await pressKey(page, 'Tab');

    const outline = await button.evaluate((el) => {
      const style = getComputedStyle(el);

      return { style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset };
    });

    expect(outline).toEqual({ style: 'solid', width: '2px', offset: '3px' });
  });

  test('blurring mid-press clears the active state', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const button = root.locator('button[et-button]').first();

    await pressKey(page, 'Tab');
    await page.keyboard.down(' ');
    await expect(button).toHaveClass(/et-focus-ring--active/);

    await button.evaluate((el) => (el as HTMLElement).blur());

    await expect(button).not.toHaveClass(/et-focus-ring--active/);
    await page.keyboard.up(' ');
  });

  test('a held Enter applies the checkbox press style through the active class', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_STORY_ID);
    const checkbox = root.locator('et-checkbox').first();
    const box = checkbox.locator('.et-checkbox-box');

    await tabUntilFocused(page, checkbox);
    const rest = await transformOf(box);

    await page.keyboard.down('Enter');

    await expect(checkbox).toHaveClass(/et-focus-ring--active/);
    await expect.poll(() => transformOf(box)).not.toBe(rest);

    await page.keyboard.up('Enter');

    await expect.poll(() => transformOf(box)).toBe(rest);
  });
});
