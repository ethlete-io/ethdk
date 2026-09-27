import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-layout-accordion--default';
const SINGLE_OPEN_STORY_ID = 'components-layout-accordion--single-open';
const ALWAYS_ONE_OPEN_STORY_ID = 'components-layout-accordion--always-one-open';
const LAZY_CONTENT_STORY_ID = 'components-layout-accordion--lazy-content';

test.describe('accordion / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the first header and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const firstTrigger = root.locator('.et-accordion-trigger').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(firstTrigger);
  });

  test('a disabled header stays in the tab order instead of being skipped', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expect(triggers.nth(2)).toBeFocused();
    await expect(triggers.nth(2)).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('accordion / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('Enter toggles the focused header, and aria-expanded and the panel follow', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');
    const panels = root.locator('.et-accordion-panel');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(triggers.nth(1)).toBeFocused();
    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'false');

    await pressKey(page, 'Enter');

    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(panels.nth(1)).not.toHaveAttribute('inert');
    await expect(panels.nth(1)).toBeVisible();
  });

  test('Space toggles the focused header open and closed', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');
    const panels = root.locator('.et-accordion-panel');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');

    await pressKey(page, ' ');
    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(panels.nth(1)).not.toHaveAttribute('inert');

    await pressKey(page, ' ');
    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(panels.nth(1)).toHaveAttribute('inert', '');
  });

  test('a disabled header does not toggle on Enter or Space', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await expect(triggers.nth(2)).toBeFocused();

    await pressKey(page, 'Enter');
    await expect(triggers.nth(2)).toHaveAttribute('aria-expanded', 'false');

    await pressKey(page, ' ');
    await expect(triggers.nth(2)).toHaveAttribute('aria-expanded', 'false');
  });

  test('ArrowDown moves focus to the next header and wraps from the last back to the first', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await pressKey(page, 'Tab');
    await expect(triggers.first()).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(triggers.nth(1)).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(triggers.nth(2)).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(triggers.first()).toBeFocused();
  });

  test('ArrowUp wraps from the first header to the last', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowUp');

    await expect(triggers.last()).toBeFocused();
  });

  test('Home and End jump focus to the first and last header', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect(triggers.last()).toBeFocused();

    await pressKey(page, 'Home');
    await expect(triggers.first()).toBeFocused();
  });

  test('autoCloseOthers closes the sibling that was open', async ({ page }) => {
    const root = await openStory(page, SINGLE_OPEN_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await expect(triggers.first()).toHaveAttribute('aria-expanded', 'true');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');

    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(triggers.first()).toHaveAttribute('aria-expanded', 'false');
  });

  test('preventCloseLast refuses to close the only open panel', async ({ page }) => {
    const root = await openStory(page, ALWAYS_ONE_OPEN_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await expect(triggers.first()).toHaveAttribute('aria-expanded', 'true');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect(triggers.first()).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('accordion / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap toggles the header, opening its panel', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');
    const panels = root.locator('.et-accordion-panel');

    await tap(triggers.nth(1));

    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(panels.nth(1)).not.toHaveAttribute('inert');
  });

  test('a tap opens deferred content on its first expand', async ({ page }) => {
    const root = await openStory(page, LAZY_CONTENT_STORY_ID);
    const deferredTrigger = root.locator('.et-accordion-trigger').nth(1);

    await tap(deferredTrigger);

    await expect(deferredTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(root.getByText(/deferred content was constructed/)).toBeVisible();
  });
});

const RETURNS_TEXT = 'prepaid label';

const chevronRotation = (trigger: Locator) =>
  trigger.locator('.et-accordion-chevron').evaluate((el) => getComputedStyle(el).rotate);

const panelHeight = async (panel: Locator) => (await boxOf(panel)).height;

const findInPage = (page: Page, text: string) =>
  page.evaluate((query) => {
    window.getSelection()?.removeAllRanges();

    return (window as Window & { find: (q: string) => boolean }).find(query);
  }, text);

async function addButtonToPanel(panel: Locator) {
  await panel.locator('.et-accordion-panel-body').evaluate((body) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Inside the panel';
    button.className = 'e2e-panel-button';
    body.append(button);
  });

  return panel.locator('.e2e-panel-button');
}

test.describe('accordion / collapse', () => {
  test('the chevron points up while open and turns down once collapsed', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');

    await expect.poll(() => chevronRotation(triggers.first())).toBe('0deg');
    await expect.poll(() => chevronRotation(triggers.nth(1))).toBe('180deg');

    await triggers.nth(1).click();

    await expect.poll(() => chevronRotation(triggers.nth(1))).toBe('0deg');
  });

  test('a collapse shrinks the panel to nothing and hides it once the track is closed', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.locator('.et-accordion-trigger').first();
    const panel = root.locator('.et-accordion-panel').first();

    expect(await panelHeight(panel)).toBeGreaterThan(20);

    await trigger.click();

    await expect(panel).toHaveCSS('visibility', 'hidden');
    await expect.poll(() => panelHeight(panel)).toBe(0);
    await expect(panel).toBeHidden();
  });

  test('under reduced motion the panel collapses at once and the chevron does not rotate', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.locator('.et-accordion-trigger').first();
    const panel = root.locator('.et-accordion-panel').first();

    await expect(panel).toHaveCSS('transition-duration', '0s');
    await expect(trigger.locator('.et-accordion-chevron')).not.toHaveCSS('transition-property', /rotate/);

    await trigger.click();

    expect(await panelHeight(panel)).toBe(0);
    await expect(panel).toHaveCSS('visibility', 'hidden');
  });

  test('find-in-page skips the text of a collapsed panel and finds it once open', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.locator('.et-accordion-trigger').nth(1);

    expect(await findInPage(page, RETURNS_TEXT)).toBe(false);

    await trigger.click();
    await expect(root.getByText(RETURNS_TEXT)).toBeVisible();

    expect(await findInPage(page, RETURNS_TEXT)).toBe(true);
  });

  test('a collapsed panel is inert: its content is neither focusable nor in the accessibility tree', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const panel = root.locator('.et-accordion-panel').nth(1);
    const button = await addButtonToPanel(panel);

    await expect(panel).toHaveAttribute('inert', '');
    await expect(root.getByRole('button', { name: 'Inside the panel' })).toHaveCount(0);

    await button.evaluate((el: HTMLElement) => el.focus());
    await expect(button).not.toBeFocused();

    await root.locator('.et-accordion-trigger').nth(1).click();

    await expect(root.getByRole('button', { name: 'Inside the panel' })).toBeVisible();
  });
});

test.describe('accordion / collapse keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab passes over a focusable inside a collapsed panel and stops on it once open', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const triggers = root.locator('.et-accordion-trigger');
    const button = await addButtonToPanel(root.locator('.et-accordion-panel').nth(1));

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await expect(triggers.nth(1)).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(triggers.nth(2)).toBeFocused();

    await pressKey(page, 'Shift+Tab');
    await pressKey(page, 'Enter');
    await pressKey(page, 'Tab');

    await expect(button).toBeFocused();
  });
});
