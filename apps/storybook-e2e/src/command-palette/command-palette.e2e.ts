import { Page, expect, test } from '@playwright/test';
import { openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-overlays-command-palette--default';

async function shortcutChord(page: Page): Promise<string> {
  const isApple = await page.evaluate(() => /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent));

  return isApple ? 'Meta+K' : 'Control+K';
}

test.describe('command-palette / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard shortcut and navigation');

  test('the shortcut opens the palette and focuses the search field', async ({ page }) => {
    await openStory(page, STORY_ID);
    const chord = await shortcutChord(page);

    await pressKey(page, chord);

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeFocused();
  });

  test('the shortcut closes the palette again', async ({ page }) => {
    await openStory(page, STORY_ID);
    const chord = await shortcutChord(page);

    await pressKey(page, chord);
    await expect(page.getByRole('dialog')).toBeVisible();

    await pressKey(page, chord);

    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('typing filters the results to matching commands', async ({ page }) => {
    await openStory(page, STORY_ID);
    const chord = await shortcutChord(page);
    await pressKey(page, chord);

    await page.getByRole('combobox').fill('table');

    await expect(page.getByRole('option', { name: 'Create table' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Export table as CSV' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Add user' })).toHaveCount(0);
  });

  test('ArrowDown moves the active option forward, ArrowUp moves it back, and aria-activedescendant follows', async ({
    page,
  }) => {
    await openStory(page, STORY_ID);
    const chord = await shortcutChord(page);
    await pressKey(page, chord);

    const search = page.getByRole('combobox');
    await search.fill('add');

    const addRow = page.getByRole('option', { name: 'Add row' });
    const addUser = page.getByRole('option', { name: 'Add user' });

    await expect(addRow).toHaveAttribute('aria-selected', 'true');
    await expect(search).toHaveAttribute('aria-activedescendant', (await addRow.getAttribute('id')) ?? '');

    await pressKey(page, 'ArrowDown');
    await expect(addUser).toHaveAttribute('aria-selected', 'true');
    await expect(search).toHaveAttribute('aria-activedescendant', (await addUser.getAttribute('id')) ?? '');

    await pressKey(page, 'ArrowUp');
    await expect(addRow).toHaveAttribute('aria-selected', 'true');
  });

  test('Enter runs the active command and closes the palette', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const chord = await shortcutChord(page);
    await pressKey(page, chord);

    await page.getByRole('combobox').fill('add');
    await pressKey(page, 'Enter');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(root.getByText('Last run: Add row')).toBeVisible();
  });

  test('Escape clears a non-empty query without closing the palette', async ({ page }) => {
    await openStory(page, STORY_ID);
    const chord = await shortcutChord(page);
    await pressKey(page, chord);

    const search = page.getByRole('combobox');
    await search.fill('table');
    await expect(page.getByRole('option', { name: 'Add user' })).toHaveCount(0);

    await pressKey(page, 'Escape');

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('option', { name: 'Add user' })).toBeVisible();
  });

  test('Escape closes the palette when the query is already empty, and focus returns to where it was', async ({
    page,
  }) => {
    const root = await openStory(page, STORY_ID);
    const openButton = root.getByRole('button', { name: 'Open the palette' });

    await pressKey(page, 'Tab');
    await expect(openButton).toBeFocused();
    await pressKey(page, 'Enter');
    await expect(page.getByRole('dialog')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(openButton).toBeFocused();
  });

  test('the combobox only claims aria-expanded and aria-controls while the query has results', async ({ page }) => {
    await openStory(page, STORY_ID);
    const chord = await shortcutChord(page);
    await pressKey(page, chord);

    const search = page.getByRole('combobox');

    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => search.getAttribute('aria-controls')).not.toBeNull();
    await expect(page.getByRole('listbox')).toBeVisible();

    await search.fill('there is no such command');

    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => search.getAttribute('aria-controls')).toBeNull();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByText('No matching command')).toBeVisible();
  });
});

test.describe('command-palette / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('a tap on the open button opens the palette and focuses the search field', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await tap(root.getByRole('button', { name: 'Open the palette' }));

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeFocused();
  });

  test('a tap on a result runs it and closes the palette', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await tap(root.getByRole('button', { name: 'Open the palette' }));
    await tap(page.getByRole('option', { name: 'Add user' }));

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(root.getByText('Last run: Add user')).toBeVisible();
  });
});
