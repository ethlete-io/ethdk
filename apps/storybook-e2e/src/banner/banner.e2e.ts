import { Locator, Page, expect, test } from '@playwright/test';
import { countClicks, expectFocusVisible, expectTouchMode, openStory, pressKey, tabSequence, tap } from '../support';

const INFO_STORY_ID = 'components-feedback-banner--info';
const SUCCESS_STORY_ID = 'components-feedback-banner--success';
const WARNING_STORY_ID = 'components-feedback-banner--warning';
const ERROR_STORY_ID = 'components-feedback-banner--error';
const WITHOUT_DISMISS_STORY_ID = 'components-feedback-banner--without-dismiss';

const BANNER = '.et-banner';
const DISMISS_BUTTON = '.et-banner-dismiss-btn';
const ACTION = '[etBannerAction]';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface BannerColors {
  primary: Rgba;
  background: Rgba;
  border: Rgba;
  icon: Rgba;
}

/** The computed colours of a banner, plus the primary of the colour scope it resolved, in 0-255 channels. */
function bannerColors(banner: Locator): Promise<BannerColors> {
  return banner.evaluate((host) => {
    const parse = (value: string) => {
      const numbers = (value.match(/[\d.]+/g) ?? []).map(Number);
      const scale = value.startsWith('color(') ? 255 : 1;
      const [r = 0, g = 0, b = 0, a = 1] = numbers;

      return { r: r * scale, g: g * scale, b: b * scale, a };
    };

    const probe = document.createElement('span');
    probe.style.color = 'var(--et-theme-color-primary-solid)';
    host.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();

    const style = getComputedStyle(host);
    const icon = host.querySelector(':scope > .et-icon');

    return {
      primary: parse(primary),
      background: parse(style.backgroundColor),
      border: parse(style.borderTopColor),
      icon: parse(icon ? getComputedStyle(icon).color : ''),
    };
  });
}

function expectTintOf(tint: Rgba, primary: Rgba, alpha: number): void {
  expect(tint.r).toBeCloseTo(primary.r, 0);
  expect(tint.g).toBeCloseTo(primary.g, 0);
  expect(tint.b).toBeCloseTo(primary.b, 0);
  expect(tint.a).toBeCloseTo(alpha, 2);
}

async function primaryOf(page: Page, storyId: string): Promise<string> {
  const root = await openStory(page, storyId);
  const { primary } = await bannerColors(root.locator(BANNER));

  return `${Math.round(primary.r)},${Math.round(primary.g)},${Math.round(primary.b)}`;
}

test.describe('banner / tint', () => {
  for (const storyId of [INFO_STORY_ID, SUCCESS_STORY_ID, WARNING_STORY_ID, ERROR_STORY_ID]) {
    test(`the fill and border are a light wash of the resolved primary for "${storyId}"`, async ({ page }) => {
      const root = await openStory(page, storyId);
      const colors = await bannerColors(root.locator(BANNER));

      expectTintOf(colors.background, colors.primary, 0.08);
      expectTintOf(colors.border, colors.primary, 0.24);
    });
  }

  test('success, warning and error each resolve their own colour theme', async ({ page }) => {
    const primaries = [
      await primaryOf(page, SUCCESS_STORY_ID),
      await primaryOf(page, WARNING_STORY_ID),
      await primaryOf(page, ERROR_STORY_ID),
    ];

    expect(new Set(primaries).size).toBe(3);
  });

  test('the leading icon takes the ink of the resolved theme', async ({ page }) => {
    const root = await openStory(page, ERROR_STORY_ID);
    const banner = root.locator(BANNER);
    const { icon } = await bannerColors(banner);
    const ink = await banner.evaluate((host) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--et-theme-color-ink-solid)';
      host.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();

      return color;
    });

    expect(`rgb(${Math.round(icon.r)}, ${Math.round(icon.g)}, ${Math.round(icon.b)})`).toBe(ink);
  });
});

test.describe('banner / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the projected action with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(ACTION));
  });

  test('Tab reaches the dismiss button with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(DISMISS_BUTTON));
  });

  test('the dismiss button follows the actions in the tab order', async ({ page }) => {
    await openStory(page, INFO_STORY_ID);

    const sequence = await tabSequence(page, 2);

    expect(sequence.map((descriptor) => descriptor.text)).toEqual(['Retry', '']);
    expect(sequence[1]?.name).toBe('Dismiss');
  });

  test('a banner without actions puts the dismiss button first in the tab order', async ({ page }) => {
    const root = await openStory(page, SUCCESS_STORY_ID);

    await expect(root.locator(ACTION)).toHaveCount(0);

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(DISMISS_BUTTON));
  });

  test('a non-dismissible banner has no dismiss button in the tab order', async ({ page }) => {
    const root = await openStory(page, WITHOUT_DISMISS_STORY_ID);

    await expect(root.locator(DISMISS_BUTTON)).toHaveCount(0);

    const sequence = await tabSequence(page, 2);

    expect(sequence[0]?.text).toBe('Retry');
    expect(sequence[1]?.name).not.toBe('Dismiss');
  });

  test('the dismiss button is labelled for assistive technology', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await expect(root.getByRole('button', { name: 'Dismiss', exact: true })).toHaveClass(/et-banner-dismiss-btn/);
  });

  test('an info banner announces politely through a status role', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'status');
  });

  test('a success banner announces politely through a status role', async ({ page }) => {
    const root = await openStory(page, SUCCESS_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'status');
  });

  test('a warning banner interrupts through an alert role', async ({ page }) => {
    const root = await openStory(page, WARNING_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'alert');
  });

  test('an error banner interrupts through an alert role', async ({ page }) => {
    const root = await openStory(page, ERROR_STORY_ID);

    await expect(root.locator(BANNER)).toHaveAttribute('role', 'alert');
  });
});

test.describe('banner / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter on the dismiss button emits dismiss', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await countClicks(dismissButton);

    await pressKey(page, 'Enter');

    await expect(dismissButton).toHaveJSProperty('__clicks', 1);
  });

  test('Space on the dismiss button emits dismiss', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await countClicks(dismissButton);

    await pressKey(page, ' ');

    await expect(dismissButton).toHaveJSProperty('__clicks', 1);
  });

  test('dismissing leaves the banner in place for its consumer to remove, and keeps focus', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await pressKey(page, 'Enter');

    await expect(root.locator(BANNER)).toBeVisible();
    await expect(dismissButton).toBeFocused();
  });

  test('Enter on the projected action activates it without dismissing the banner', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const action = root.locator(ACTION);

    await action.focus();
    await countClicks(action);

    await pressKey(page, 'Enter');

    await expect(action).toHaveJSProperty('__clicks', 1);
    await expect(root.locator(BANNER)).toBeVisible();
  });

  test('Escape does not dismiss a banner', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await dismissButton.focus();
    await countClicks(dismissButton);

    await pressKey(page, 'Escape');

    await expect(dismissButton).toHaveJSProperty('__clicks', 0);
    await expect(root.locator(BANNER)).toBeVisible();
  });
});

test.describe('banner / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, INFO_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on the dismiss button emits dismiss', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const dismissButton = root.locator(DISMISS_BUTTON);

    await countClicks(dismissButton);

    await tap(dismissButton);

    await expect(dismissButton).toHaveJSProperty('__clicks', 1);
    await expect(root.locator(BANNER)).toBeVisible();
  });

  test('a tap on the projected action activates it', async ({ page }) => {
    const root = await openStory(page, INFO_STORY_ID);
    const action = root.locator(ACTION);

    await countClicks(action);

    await tap(action);

    await expect(action).toHaveJSProperty('__clicks', 1);
  });

  test('a non-dismissible banner renders no dismiss target', async ({ page }) => {
    const root = await openStory(page, WITHOUT_DISMISS_STORY_ID);

    await expect(root.locator(BANNER)).toBeVisible();
    await expect(root.locator(DISMISS_BUTTON)).toHaveCount(0);
  });
});
