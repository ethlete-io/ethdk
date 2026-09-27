import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, settle, tap, viewportOf } from '../support';

const STORY_ID = 'components-overlays-menu--default';
const WITHOUT_HOVER_OPEN_STORY_ID = 'components-overlays-menu--without-hover-open';
const CONTEXT_STORY_ID = 'components-overlays-menu--context-menu';

/**
 * Menu items indicate focus with a `[data-active]` background highlight, not an outline or
 * box-shadow ring (`.et-menu-item` sets `outline: none` - see menu.component.css) - so this
 * checks the item's own focus contract instead of the generic `expectFocusVisible` helper.
 */
async function expectItemFocusVisible(item: Locator): Promise<void> {
  await expect(item).toBeFocused();
  await expect(item).toHaveAttribute('data-active', 'true');

  const matchesFocusVisible = await item.evaluate((el) => el.matches(':focus-visible'));
  expect(matchesFocusVisible).toBe(true);
}

/**
 * Opens the root menu from the trigger and moves focus down to the "Export as" submenu trigger
 * item, asserting each step so a slow overlay mount can never let the next key land early.
 */
async function focusExportAsItem(page: Page): Promise<void> {
  await pressKey(page, 'Tab');
  await pressKey(page, 'ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();
  await pressKey(page, 'ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Save' })).toBeFocused();
  await pressKey(page, 'ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Export as' })).toBeFocused();
}

async function pushTriggerTo(page: Page, edge: 'bottom' | 'right', distance: number): Promise<void> {
  const { width, height } = viewportOf(page);

  await page.locator('.et-sb-menu-page').evaluate(
    (element, { edge, offset }) => {
      const page = element as HTMLElement;

      page.style.boxSizing = 'border-box';
      page.style.minHeight = '100vh';
      page.style.display = 'flex';
      page.style.alignItems = 'flex-start';
      page.style[edge === 'bottom' ? 'paddingTop' : 'paddingLeft'] = `${offset}px`;
    },
    { edge, offset: edge === 'bottom' ? height - distance : width - distance },
  );
}

async function activeBackgroundOf(item: Locator): Promise<string> {
  return item.evaluate((element) => getComputedStyle(element).backgroundColor);
}

async function waitForMenuOpen(page: Page): Promise<void> {
  await expect(page.locator('.et-overlay--menu.et-animation-enter-done').first()).toBeVisible();
}

test.describe('menu / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: click and outside-click behavior');

  test('a click on the trigger opens the menu and focuses the first item', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await trigger.click();

    await expect(page.getByRole('menu')).toBeVisible();
    // a mouse-driven open never satisfies :focus-visible (menu.component.css requires it
    // alongside [data-active] before the highlight shows) - only the roving tabindex moves
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('a click outside the open menu closes it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await expect(page.getByRole('menu')).toBeHidden();
  });
});

test.describe('menu / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('Enter opens the menu and focuses the first item', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expectItemFocusVisible(page.getByRole('menuitem', { name: 'New file' }));
  });

  test('Space opens the menu and focuses the first item', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Space');

    await expectItemFocusVisible(page.getByRole('menuitem', { name: 'New file' }));
  });

  test('ArrowDown opens the menu and focuses the first item', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');

    await expectItemFocusVisible(page.getByRole('menuitem', { name: 'New file' }));
  });

  test('ArrowUp opens the menu and focuses the last item', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowUp');

    await expectItemFocusVisible(page.getByRole('menuitem', { name: 'Delete' }));
  });

  test('ArrowDown moves through the enabled items and wraps from the last back to the first', async ({ page }) => {
    await openStory(page, STORY_ID);
    const items = ['New file', 'Save', 'Export as', 'Delete'];

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();

    for (let i = 1; i < items.length; i++) {
      await pressKey(page, 'ArrowDown');
      await expect(page.getByRole('menuitem', { name: items[i] })).toBeFocused();
    }

    await pressKey(page, 'ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();
  });

  test('ArrowUp wraps from the first item to the last', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();
    await pressKey(page, 'ArrowUp');

    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  });

  test('Home and End jump focus to the first and last enabled item', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();

    await pressKey(page, 'End');
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();

    await pressKey(page, 'Home');
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();
  });

  test('typeahead moves focus to the item starting with the typed character', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeFocused();
    await pressKey(page, 's');

    await expect(page.getByRole('menuitem', { name: 'Save' })).toBeFocused();
  });

  test('a disabled item is skipped by arrow navigation', async ({ page }) => {
    await openStory(page, STORY_ID);

    await focusExportAsItem(page);

    await expect(page.getByRole('menuitem', { name: 'Publish (disabled)' })).not.toBeFocused();
    await expect(page.getByRole('menuitem', { name: 'Export as' })).toBeFocused();
  });

  test('Escape closes the menu and returns focus to the trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('ArrowRight opens a submenu and focuses its first item', async ({ page }) => {
    await openStory(page, STORY_ID);

    await focusExportAsItem(page);
    await pressKey(page, 'ArrowRight');

    await expectItemFocusVisible(page.getByRole('menuitem', { name: 'PDF' }));
  });

  test('ArrowLeft closes a submenu and returns focus to its trigger item', async ({ page }) => {
    await openStory(page, STORY_ID);

    await focusExportAsItem(page);
    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');

    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeHidden();
    await expect(page.getByRole('menuitem', { name: 'Export as' })).toBeFocused();
  });

  test('a nested submenu opens and closes a level at a time', async ({ page }) => {
    await openStory(page, STORY_ID);

    await focusExportAsItem(page);
    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeFocused();
    await pressKey(page, 'ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'CSV' })).toBeFocused();
    await pressKey(page, 'ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'More formats' })).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'XML' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(page.getByRole('menuitem', { name: 'XML' })).toBeHidden();
    await expect(page.getByRole('menuitem', { name: 'More formats' })).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeHidden();
    await expect(page.getByRole('menuitem', { name: 'Export as' })).toBeFocused();
  });
});

test.describe('menu / focus ring', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  test('the keyboard-active item paints the active background, its idle siblings do not', async ({ page }) => {
    await openStory(page, STORY_ID);
    const newFile = page.getByRole('menuitem', { name: 'New file' });
    const save = page.getByRole('menuitem', { name: 'Save' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expectItemFocusVisible(newFile);
    await waitForMenuOpen(page);
    await settle(page, 200);

    const active = await activeBackgroundOf(newFile);

    expect(active).not.toBe(await activeBackgroundOf(save));
    expect(active).not.toBe('rgba(0, 0, 0, 0)');

    await pressKey(page, 'ArrowDown');
    await expectItemFocusVisible(save);
    await settle(page, 200);

    expect(await activeBackgroundOf(save)).toBe(active);
    expect(await activeBackgroundOf(newFile)).not.toBe(active);
  });
});

test.describe('menu / placement', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: placement is covered once');

  test('a root menu opens below its trigger, start-aligned, with the arrow pointing at the trigger', async ({
    page,
  }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await trigger.click();
    await waitForMenuOpen(page);

    const anchor = await boxOf(trigger);
    const menu = await boxOf(page.getByRole('menu'));
    const arrow = await boxOf(page.locator('.et-overlay-arrow'));

    expect(menu.y).toBeGreaterThan(anchor.y + anchor.height);
    expect(Math.abs(menu.x - anchor.x)).toBeLessThanOrEqual(1);
    expect(arrow.x).toBeGreaterThanOrEqual(anchor.x);
    expect(arrow.x + arrow.width).toBeLessThanOrEqual(anchor.x + anchor.width);
    expect(arrow.y).toBeLessThan(menu.y);
    expect(arrow.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
  });

  test('a root menu moves above its trigger when less than 160px are left below', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await pushTriggerTo(page, 'bottom', 120);
    await trigger.click();
    await waitForMenuOpen(page);

    const anchor = await boxOf(trigger);
    const menu = await boxOf(page.getByRole('menu'));

    expect(menu.y + menu.height).toBeLessThan(anchor.y);
  });

  test('a root menu stays below and shrinks when 160px or more are left below', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await pushTriggerTo(page, 'bottom', 220);
    await trigger.click();
    await waitForMenuOpen(page);

    const anchor = await boxOf(trigger);
    const menu = await boxOf(page.getByRole('menu'));

    expect(menu.y).toBeGreaterThan(anchor.y + anchor.height);
    expect(menu.y + menu.height).toBeLessThanOrEqual(viewportOf(page).height);
  });

  test('a submenu opens to the right of its trigger item', async ({ page }) => {
    await openStory(page, STORY_ID);
    const exportAs = page.getByRole('menuitem', { name: 'Export as' });

    await focusExportAsItem(page);
    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeFocused();

    const item = await boxOf(exportAs);
    const submenu = await boxOf(page.getByRole('menu').last());

    expect(submenu.x).toBeGreaterThan(item.x + item.width / 2);
    expect(submenu.x + submenu.width).toBeGreaterThan(item.x + item.width + 40);
  });

  test('a submenu flips to the left of its trigger item at the viewport edge', async ({ page }) => {
    await openStory(page, STORY_ID);
    const exportAs = page.getByRole('menuitem', { name: 'Export as' });

    await pushTriggerTo(page, 'right', 260);
    await focusExportAsItem(page);
    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeFocused();

    const flippedItem = await boxOf(exportAs);
    const flipped = await boxOf(page.getByRole('menu').last());

    expect(flipped.x + flipped.width).toBeLessThan(flippedItem.x + flippedItem.width / 2);
    expect(flipped.x).toBeLessThan(flippedItem.x - 40);
    expect(flipped.x).toBeGreaterThanOrEqual(0);
  });
});

test.describe('menu / hover', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hovering a submenu trigger item opens the submenu without moving focus into it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await root.getByRole('button', { name: 'File' }).click();
    await waitForMenuOpen(page);

    await page.getByRole('menuitem', { name: 'Export as' }).hover();

    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'PDF' })).not.toBeFocused();
  });

  test('moving the pointer to a sibling item closes the hover-opened submenu', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await root.getByRole('button', { name: 'File' }).click();
    await waitForMenuOpen(page);

    await page.getByRole('menuitem', { name: 'Export as' }).hover();
    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Save' }).hover();

    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeHidden();
  });

  test('with hoverOpen off, hovering a submenu trigger item leaves the submenu shut', async ({ page }) => {
    const root = await openStory(page, WITHOUT_HOVER_OPEN_STORY_ID);

    await root.getByRole('button', { name: 'File' }).click();
    await waitForMenuOpen(page);

    await page.getByRole('menuitem', { name: 'Export as' }).hover();
    await settle(page, 600);

    await expect(page.getByRole('menuitem', { name: 'PDF' })).toHaveCount(0);

    await page.getByRole('menuitem', { name: 'Export as' }).click();

    await expect(page.getByRole('menuitem', { name: 'PDF' })).toBeVisible();
  });
});

test.describe('menu / context menu', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: right click');

  test('a right click opens the menu at the cursor and focuses the first item', async ({ page }) => {
    const root = await openStory(page, CONTEXT_STORY_ID);
    const zone = await boxOf(root.getByText('Right click anywhere in this area'));
    const point = { x: zone.x + 40, y: zone.y + 30 };

    await page.mouse.click(point.x, point.y, { button: 'right' });
    await waitForMenuOpen(page);

    const menu = await boxOf(page.getByRole('menu'));

    expect(Math.abs(menu.x - point.x)).toBeLessThanOrEqual(12);
    expect(Math.abs(menu.y - point.y)).toBeLessThanOrEqual(12);
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeFocused();
  });

  test('a second right click repositions the open menu to the new cursor point', async ({ page }) => {
    const root = await openStory(page, CONTEXT_STORY_ID);
    const zone = await boxOf(root.getByText('Right click anywhere in this area'));

    await page.mouse.click(zone.x + 40, zone.y + 30, { button: 'right' });
    await waitForMenuOpen(page);

    const second = { x: zone.x + zone.width - 260, y: zone.y + 60 };

    await page.mouse.click(second.x, second.y, { button: 'right' });

    await expect(page.getByRole('menu')).toHaveCount(1);
    await expect
      .poll(async () => {
        const menu = await boxOf(page.getByRole('menu'));

        return Math.abs(menu.x - second.x) <= 12 && Math.abs(menu.y - second.y) <= 12;
      })
      .toBe(true);
  });

  test('Escape closes the context menu and an item click runs its action', async ({ page }) => {
    const root = await openStory(page, CONTEXT_STORY_ID);
    const zone = await boxOf(root.getByText('Right click anywhere in this area'));

    await page.mouse.click(zone.x + 40, zone.y + 30, { button: 'right' });
    await waitForMenuOpen(page);
    await pressKey(page, 'Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.mouse.click(zone.x + 40, zone.y + 30, { button: 'right' });
    await waitForMenuOpen(page);
    await page.getByRole('menuitem', { name: 'Paste' }).click();

    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(root.getByText('Last action: Paste')).toBeVisible();
  });
});

test.describe('menu / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('a tap opens the menu as the same anchored overlay, not a sheet', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await tap(trigger);

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(page.locator('.et-overlay--menu')).toHaveCount(1);
    await expect(page.locator('.et-overlay--menu[data-sheet], .et-sheet')).toHaveCount(0);
  });

  test('a tap on an item activates it and closes the menu', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'File' });

    await tap(trigger);
    await tap(page.getByRole('menuitem', { name: 'Save' }));

    await expect(page.getByRole('menu')).toBeHidden();
    await expect(root.getByText('Last action: Save')).toBeVisible();
  });
});
