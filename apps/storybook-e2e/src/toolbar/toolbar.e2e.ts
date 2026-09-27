import { Locator, Page, expect, test } from '@playwright/test';
import { at, countClicks, expectFocusVisible, openStory, pressKey, settle, tap } from '../support';

const DEFAULT_STORY_ID = 'components-layout-toolbar--default';
const VERTICAL_STORY_ID = 'components-layout-toolbar--vertical';
const DISABLED_STORY_ID = 'components-layout-toolbar--disabled-control';
const NESTED_STORY_ID = 'components-layout-toolbar--nested';

const CONTROLS = ['Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list', 'Quote', 'Link'];
const OUTER_CONTROLS = ['Bulleted list', 'Numbered list', 'Quote', 'Link'];
const INNER_CONTROLS = ['Bold', 'Italic', 'Underline'];

test.describe('toolbar / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('Tab reaches the toolbar on one control and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const bold = root.getByRole('button', { name: 'Bold' });

    await pressKey(page, 'Tab');

    await expectFocusVisible(bold);
  });

  test('ArrowRight moves through every control and wraps from the last back to the first', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: CONTROLS[0] })).toBeFocused();

    for (let i = 1; i < CONTROLS.length; i++) {
      await pressKey(page, 'ArrowRight');
      await expect(root.getByRole('button', { name: CONTROLS[i] })).toBeFocused();
    }

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: CONTROLS[0] })).toBeFocused();
  });

  test('ArrowLeft wraps from the first control to the last', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowLeft');

    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('Home and End jump focus to the first and last control', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');

    await pressKey(page, 'End');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();

    await pressKey(page, 'Home');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test('arrow navigation skips a disabled control', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Underline' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('ArrowDown and ArrowUp move focus in the vertical toolbar and wrap', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('the vertical toolbar reports its orientation', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);

    await expect(root.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'vertical');
  });

  test('Tab leaves the toolbar after its single tab stop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'Tab');

    const insideToolbar = await page.evaluate(() => !!document.activeElement?.closest('[role="toolbar"]'));
    expect(insideToolbar).toBe(false);
  });

  test('the tab stop stays on the last-focused control across a Tab out and back', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'Tab');
    await pressKey(page, 'Shift+Tab');

    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();
  });
});

async function setDirection(root: Locator, dir: 'rtl' | 'ltr'): Promise<void> {
  await root.locator('.et-toolbar').evaluate((el, value) => el.setAttribute('dir', value), dir);
}

test.describe('toolbar / rtl', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('in a right-to-left toolbar the first control sits at the right edge', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await setDirection(root, 'rtl');

    const bold = await root.getByRole('button', { name: 'Bold' }).boundingBox();
    const link = await root.getByRole('button', { name: 'Link' }).boundingBox();

    expect(bold?.x).toBeGreaterThan(link?.x ?? Infinity);
  });

  test('ArrowLeft moves to the next control and ArrowRight to the previous one', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await setDirection(root, 'rtl');

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('Home and End keep to DOM order in a right-to-left toolbar', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await setDirection(root, 'rtl');

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();

    await pressKey(page, 'Home');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test('a vertical toolbar keeps ArrowDown in RTL and ignores the horizontal arrows', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    await setDirection(root, 'rtl');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'ArrowRight');
    await settle(page, 50);

    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();
  });
});

async function expectFocusOutsideToolbars(page: Page): Promise<void> {
  const insideToolbar = await page.evaluate(() => !!document.activeElement?.closest('[role="toolbar"]'));

  expect(insideToolbar).toBe(false);
}

function backwards(names: string[]): string[] {
  return [at(names, 0), ...names.slice(1).reverse()];
}

async function expectArrowCycle(page: Page, root: Locator, key: string, names: string[]): Promise<void> {
  for (const name of [...names.slice(1), names[0]]) {
    await pressKey(page, key);
    await expect(root.getByRole('button', { name, exact: true })).toBeFocused();
  }
}

async function openNestedStory(page: Page): Promise<Locator> {
  const root = await openStory(page, NESTED_STORY_ID);

  await expect(root.getByRole('button', { name: 'Numbered list' })).toHaveAttribute('tabindex', '-1');
  await expect(root.getByRole('button', { name: 'Italic' })).toHaveAttribute('tabindex', '-1');

  return root;
}

function tabStops(toolbar: Locator): Locator {
  return toolbar.locator('button:not([tabindex="-1"])');
}

test.describe('toolbar / nested', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('each toolbar level owns exactly one tab stop', async ({ page }) => {
    const root = await openNestedStory(page);
    const outer = root.getByRole('toolbar', { name: 'Editor' });
    const inner = root.getByRole('toolbar', { name: 'Text formatting' });

    await expect(tabStops(outer)).toHaveCount(2);
    await expect(tabStops(inner)).toHaveCount(1);
    await expect(tabStops(outer).first()).toHaveAccessibleName('Bulleted list');
    await expect(tabStops(inner)).toHaveAccessibleName('Bold');
  });

  test('Tab enters the outer toolbar, then the nested one, then leaves both', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await expectFocusVisible(root.getByRole('button', { name: 'Bulleted list' }));

    await pressKey(page, 'Tab');
    await expectFocusVisible(root.getByRole('button', { name: 'Bold' }));

    await pressKey(page, 'Tab');
    await expectFocusOutsideToolbars(page);
  });

  test('Shift+Tab walks back out of the nested toolbar into the outer one', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'Shift+Tab');
    await expect(root.getByRole('button', { name: 'Bulleted list' })).toBeFocused();
  });

  test('the outer arrow keys skip the nested toolbar and wrap over the outer controls', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await expectArrowCycle(page, root, 'ArrowRight', OUTER_CONTROLS);
    await expectArrowCycle(page, root, 'ArrowLeft', backwards(OUTER_CONTROLS));
  });

  test('Home and End in the outer toolbar reach its own first and last control', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();

    await pressKey(page, 'Home');
    await expect(root.getByRole('button', { name: 'Bulleted list' })).toBeFocused();
  });

  test('the arrow keys inside the nested toolbar stay inside it and wrap', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await expectArrowCycle(page, root, 'ArrowRight', INNER_CONTROLS);
    await expectArrowCycle(page, root, 'ArrowLeft', backwards(INNER_CONTROLS));
  });

  test('Home and End inside the nested toolbar stay inside it', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await pressKey(page, 'End');
    await expect(root.getByRole('button', { name: 'Underline' })).toBeFocused();

    await pressKey(page, 'Home');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test('arrow navigation in one level leaves the other level on its tab stop', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Numbered list' })).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();

    await pressKey(page, 'Shift+Tab');
    await expect(root.getByRole('button', { name: 'Numbered list' })).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(root.getByRole('button', { name: 'Italic' })).toBeFocused();
  });

  test('an outer tab stop past the nested toolbar puts the nested one before it in the tab order', async ({ page }) => {
    const root = await openNestedStory(page);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');
    await expect(root.getByRole('button', { name: 'Link' })).toBeFocused();

    await pressKey(page, 'Shift+Tab');
    await expect(root.getByRole('button', { name: 'Bold' })).toBeFocused();

    await pressKey(page, 'Shift+Tab');
    await expectFocusOutsideToolbars(page);
  });
});

test.describe('toolbar / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('a tap activates a control and moves the tab stop to it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const italic = root.getByRole('button', { name: 'Italic' });

    await countClicks(italic);
    await tap(italic);

    await expect(italic).toBeFocused();
    expect(await italic.evaluate((el) => (el as HTMLElement & { __clicks?: number }).__clicks)).toBe(1);
  });
});
