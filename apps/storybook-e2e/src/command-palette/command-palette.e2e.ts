import { Page, expect, test } from '@playwright/test';
import { openStory, pressKey, pressKeys, tap } from '../support';

const STORY_ID = 'components-overlays-command-palette--default';
const COLOR_CONTEXT_STORY_ID = 'components-overlays-command-palette--color-context';

async function shortcutChord(page: Page): Promise<string> {
  const isApple = await page.evaluate(() => /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent));

  return isApple ? 'Meta+K' : 'Control+K';
}

async function fakePlatform(page: Page, platform: string): Promise<void> {
  await page.addInitScript((value) => {
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => value, configurable: true });
  }, platform);
}

async function expectActiveOptionInsideList(page: Page): Promise<void> {
  const inside = await page.evaluate(() => {
    const option = document.querySelector('[role="option"][aria-selected="true"]');
    const scroller = option?.closest('.et-command-palette-list');
    const optionRect = option?.getBoundingClientRect();
    const scrollerRect = scroller?.getBoundingClientRect();

    return (
      !!optionRect &&
      !!scrollerRect &&
      (scroller?.scrollTop ?? 0) > 0 &&
      optionRect.top >= scrollerRect.top - 1 &&
      optionRect.bottom <= scrollerRect.bottom + 1
    );
  });

  expect(inside).toBe(true);
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

test.describe('command-palette / platform', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard shortcut');

  test('on an Apple platform Cmd+K opens the palette and Ctrl+K does not', async ({ page }) => {
    await fakePlatform(page, 'MacIntel');
    await openStory(page, STORY_ID);

    await pressKey(page, 'Control+K');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await pressKey(page, 'Meta+K');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeFocused();
  });

  test('on a non-Apple platform Ctrl+K opens the palette and Cmd+K does not', async ({ page }) => {
    await fakePlatform(page, 'Win32');
    await openStory(page, STORY_ID);

    await pressKey(page, 'Meta+K');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await pressKey(page, 'Control+K');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeFocused();
  });

  test('the shortcut hint prints the modifier of the platform', async ({ page }) => {
    await fakePlatform(page, 'MacIntel');
    const appleRoot = await openStory(page, STORY_ID);
    await expect(appleRoot.locator('et-kbd').first()).toContainText('⌘');

    const other = await page.context().newPage();
    await fakePlatform(other, 'Win32');
    const otherRoot = await openStory(other, STORY_ID);
    await expect(otherRoot.locator('et-kbd').first()).toContainText('Ctrl');
    await other.close();
  });
});

test.describe('command-palette / scrolling and focus return', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('the active row scrolls into view when arrow keys move it past the visible part of the list', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 360 });
    await openStory(page, STORY_ID);
    await pressKey(page, await shortcutChord(page));
    await expect(page.getByRole('combobox')).toBeFocused();

    await pressKeys(
      page,
      Array.from({ length: 7 }, () => 'ArrowDown'),
    );

    await expectActiveOptionInsideList(page);
  });

  test('running a command from the open button returns focus to that button', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const openButton = root.getByRole('button', { name: 'Open the palette' });

    await pressKey(page, 'Tab');
    await expect(openButton).toBeFocused();
    await pressKey(page, 'Enter');
    await expect(page.getByRole('combobox')).toBeFocused();

    await page.getByRole('combobox').fill('create');
    await pressKey(page, 'Enter');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(openButton).toBeFocused();
  });

  test('closing with the shortcut returns focus to the element focused before it opened', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const toggle = root.getByRole('button', { name: 'Select a row' });
    const chord = await shortcutChord(page);

    await toggle.focus();
    await pressKey(page, chord);
    await expect(page.getByRole('combobox')).toBeFocused();

    await pressKey(page, chord);

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(toggle).toBeFocused();
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

interface PaletteColors {
  originPrimary: string;
  originInk: string;
  palettePrimary: string;
  paletteInk: string;
  matchColor: string;
}

function paletteColors(page: Page): Promise<PaletteColors> {
  return page.evaluate(() => {
    const resolve = (scope: Element, token: string) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      scope.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();

      return color;
    };
    const origin = document.querySelector('et-sb-command-palette');
    const palette = document.querySelector('et-command-palette');
    const match = document.querySelector('.et-command-palette-item-match');

    if (!origin || !palette || !match || origin.contains(palette)) {
      throw new Error('Expected the palette open in its own overlay pane, with a highlighted match.');
    }

    return {
      originPrimary: resolve(origin, '--et-theme-color-primary-solid'),
      originInk: resolve(origin, '--et-theme-color-ink-solid'),
      palettePrimary: resolve(palette, '--et-theme-color-primary-solid'),
      paletteInk: resolve(palette, '--et-theme-color-ink-solid'),
      matchColor: getComputedStyle(match).color,
    };
  });
}

async function openPaletteWithQuery(page: Page, query: string): Promise<void> {
  await page.getByRole('button', { name: 'Open the palette' }).click();
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.getByRole('combobox').fill(query);
  await expect(page.locator('.et-command-palette-item-match').first()).toBeVisible();
}

test.describe('command-palette / colour context', () => {
  test('the palette re-applies the colour theme of the scope it was opened from', async ({ page }) => {
    await openStory(page, COLOR_CONTEXT_STORY_ID);
    await openPaletteWithQuery(page, 'row');

    await expect(page.locator('et-command-palette')).toHaveClass(/\bet-color--danger\b/);

    const colors = await paletteColors(page);

    expect(colors.originPrimary).toBe('rgb(220, 38, 38)');
    expect(colors.palettePrimary).toBe(colors.originPrimary);
    expect(colors.paletteInk).toBe(colors.originInk);
    expect(colors.matchColor).toBe(colors.originInk);
  });

  test('without a colour scope around it the palette keeps the default theme', async ({ page }) => {
    await openStory(page, STORY_ID);
    await openPaletteWithQuery(page, 'row');

    await expect(page.locator('et-command-palette')).toHaveClass(/\bet-color--inherited\b/);

    const colors = await paletteColors(page);

    expect(colors.originPrimary).toBe('rgb(0, 255, 161)');
    expect(colors.palettePrimary).toBe(colors.originPrimary);
    expect(colors.matchColor).toBe(colors.originInk);
  });
});
