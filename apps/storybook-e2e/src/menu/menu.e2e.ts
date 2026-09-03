import { Locator, Page, expect, test } from '@playwright/test';
import { openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-overlays-menu--default';

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
