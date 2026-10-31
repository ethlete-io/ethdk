import { Locator, Page, expect, test } from '@playwright/test';
import {
  boxOf,
  colorIn,
  countClicks,
  expectFocusVisible,
  openStory,
  pressKey,
  setColorScheme,
  settle,
  tabUntilFocused,
  tap,
} from '../support';

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

test('filled icon buttons have a round shape and inset themed edge', async ({ page }) => {
  const root = await openStory(page, ICON_STORY_ID);
  const button = root.locator('button[et-icon-button][data-variant="filled"]').first();
  const styles = await button.evaluate((el) => {
    const style = getComputedStyle(el);

    return { radius: style.borderRadius, shadow: style.boxShadow, width: style.width, height: style.height };
  });

  expect(styles.width).toBe(styles.height);
  expect(parseFloat(styles.radius)).toBeGreaterThanOrEqual(parseFloat(styles.width) / 2);
  expect(styles.shadow).toContain('inset');
  expect(styles.shadow).toContain(await colorIn(button, 'var(--et-theme-color-ink-solid)'));
});

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

  for (const [scheme, token] of [
    ['light', 'var(--et-theme-color-ink-solid)'],
    ['dark', 'var(--et-theme-color-primary-solid)'],
  ] as const) {
    test(`the focus ring is drawn in ${token} in the ${scheme} scheme`, async ({ page }) => {
      const root = await openStory(page, STORY_ID, { args: { color: 'danger' } });
      const button = root.locator('button[et-button]').first();

      await setColorScheme(root, scheme);
      await pressKey(page, 'Tab');
      await expectFocusVisible(button);

      const ink = await colorIn(button, 'var(--et-theme-color-ink-solid)');
      const primary = await colorIn(button, 'var(--et-theme-color-primary-solid)');

      expect(ink).not.toBe(primary);
      const expected = await colorIn(button, token);

      await expect
        .poll(async () => colorIn(button, await button.evaluate((el) => getComputedStyle(el).outlineColor)))
        .toBe(expected);
    });
  }

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

type SpinnerFrame = { sweep: boolean; ringOpacity: number };

const spinnerFrames = (page: Page) =>
  page.evaluate(() => (window as unknown as { spinnerFrames: SpinnerFrame[] }).spinnerFrames);

test.describe('button / query progress', () => {
  test('the spinner crossfades from indeterminate to the first progress instead of snapping', async ({ page }) => {
    const root = await openStory(page, 'components-actions-button-query--default');

    await page.evaluate(() => {
      const frames: SpinnerFrame[] = [];

      (window as unknown as { spinnerFrames: SpinnerFrame[] }).spinnerFrames = frames;

      const sample = () => {
        const ring = document.querySelector('.et-button-loader .et-spinner-determinate-graphic');

        if (ring) {
          frames.push({
            sweep: !!document.querySelector('.et-button-loader .et-spinner-indeterminate'),
            ringOpacity: Number(getComputedStyle(ring).opacity),
          });
        }

        if (!frames.length) requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    });

    await root.locator('button[et-button]').first().click();

    await expect.poll(async () => (await spinnerFrames(page)).length).toBeGreaterThan(0);

    const [firstFrame] = await spinnerFrames(page);

    expect(firstFrame?.sweep).toBe(true);
    expect(firstFrame?.ringOpacity).toBeLessThan(1);
  });
});
