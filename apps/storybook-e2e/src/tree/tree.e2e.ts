import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, pressKeys, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-tree--default';
const DISABLED_STORY_ID = 'components-data-display-tree--disabled';
const MULTI_SELECT_STORY_ID = 'components-data-display-tree--multi-select';
const NAVIGATION_ONLY_STORY_ID = 'components-data-display-tree--navigation-only';
const LAZY_LOADING_STORY_ID = 'components-data-display-tree--lazy-loading';

const INDENT_PX = 18;

function chevronRotation(row: Locator): Promise<string> {
  return row.locator('.et-tree-node-chevron').evaluate((el) => getComputedStyle(el).rotate);
}

function labelEdges(row: Locator): Promise<{ left: number; right: number }> {
  return row.locator('.et-tree-node-label').evaluate((el) => {
    const rect = el.getBoundingClientRect();

    return { left: Math.round(rect.left), right: Math.round(rect.right) };
  });
}

async function setTreeDirection(root: Locator, dir: 'rtl' | 'ltr'): Promise<void> {
  await root.locator('.et-tree').evaluate((el, value) => el.setAttribute('dir', value), dir);
}

async function constrainTreeHeight(root: Locator, px: number): Promise<void> {
  await root.locator('.et-tree').evaluate((el, height) => {
    const tree = el as HTMLElement;

    tree.style.blockSize = `${height}px`;
    tree.style.overflowY = 'auto';
  }, px);
}

/** Whether the row lies fully inside the tree's scrollport. */
function rowInsideTree(root: Locator, name: string): Promise<boolean> {
  return root.locator('.et-tree').evaluate((tree, label) => {
    const row = Array.from(tree.querySelectorAll('.et-tree-node')).find((el) => el.textContent?.trim() === label);

    if (!row) return false;

    const outer = tree.getBoundingClientRect();
    const inner = row.getBoundingClientRect();

    return inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
  }, name);
}

function checkMark(row: Locator): Promise<{ markOpacity: string; background: string }> {
  return row.locator('.et-tree-node-check').evaluate((el) => ({
    markOpacity: getComputedStyle(el, '::after').opacity,
    background: getComputedStyle(el).backgroundColor,
  }));
}

test.describe('tree / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the first row and the focus ring is visible; the rest of the tree is out of tab order', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });
    const app = root.getByRole('treeitem', { name: 'app' });

    await pressKey(page, 'Tab');

    await expectFocusVisible(src);
    await expect(app).toHaveAttribute('tabindex', '-1');
  });
});

test.describe('tree / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('ArrowDown and ArrowUp move focus across rows; Home and End jump to the first and last', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });
    const app = root.getByRole('treeitem', { name: 'app' });

    await pressKey(page, 'Tab');
    await expect(src).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(app).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(src).toBeFocused();

    await pressKey(page, 'End');
    await expect(root.getByRole('treeitem', { name: 'README.md' })).toBeFocused();

    await pressKey(page, 'Home');
    await expect(src).toBeFocused();
  });

  test('ArrowRight expands a collapsed branch, then moves focus into it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const docs = root.getByRole('treeitem', { name: 'docs' });

    await pressKey(page, 'Tab');
    await pressKeys(page, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);
    await expect(docs).toBeFocused();
    await expect(docs).toHaveAttribute('aria-expanded', 'false');

    await pressKey(page, 'ArrowRight');
    await expect(docs).toHaveAttribute('aria-expanded', 'true');
    await expect(docs).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(root.getByRole('treeitem', { name: 'getting-started.md' })).toBeFocused();
  });

  test('ArrowLeft collapses an expanded branch and keeps focus on it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });

    await pressKey(page, 'Tab');
    await expect(src).toHaveAttribute('aria-expanded', 'true');

    await pressKey(page, 'ArrowLeft');

    await expect(src).toHaveAttribute('aria-expanded', 'false');
    await expect(src).toBeFocused();
  });

  test('ArrowLeft on a non-expandable row moves focus to its parent', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });
    const mainTs = root.getByRole('treeitem', { name: 'main.ts' });

    await pressKey(page, 'Tab');
    await pressKeys(page, ['ArrowDown', 'ArrowDown', 'ArrowDown']);
    await expect(mainTs).toBeFocused();

    await pressKey(page, 'ArrowLeft');

    await expect(src).toBeFocused();
  });

  test('Enter activates a branch: it expands and selects in one step', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const docs = root.getByRole('treeitem', { name: 'docs' });

    await pressKey(page, 'Tab');
    await pressKeys(page, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);
    await expect(docs).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(docs).toHaveAttribute('aria-expanded', 'true');
    await expect(docs).toHaveAttribute('aria-selected', 'true');
  });

  test('Space selects a row without expanding it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const docs = root.getByRole('treeitem', { name: 'docs' });

    await pressKey(page, 'Tab');
    await pressKeys(page, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);

    await pressKey(page, ' ');

    await expect(docs).toHaveAttribute('aria-selected', 'true');
    await expect(docs).toHaveAttribute('aria-expanded', 'false');
  });

  test('typeahead focuses the next row whose label starts with the typed character', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });
    const docs = root.getByRole('treeitem', { name: 'docs' });

    await pressKey(page, 'Tab');
    await expect(src).toBeFocused();

    await pressKey(page, 'd');

    await expect(docs).toBeFocused();
  });

  test('a disabled tree keeps rows reachable but blocks expand and select', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });

    await pressKey(page, 'Tab');
    await expect(src).toBeFocused();
    await expect(src).toHaveAttribute('aria-expanded', 'true');

    await pressKey(page, 'ArrowLeft');
    await expect(src).toHaveAttribute('aria-expanded', 'true');

    await pressKey(page, 'Enter');
    await expect(src).toHaveAttribute('aria-selected', 'false');
  });

  test('selectionMode "none" never sets aria-selected, but expansion and activation still work', async ({ page }) => {
    const root = await openStory(page, NAVIGATION_ONLY_STORY_ID);
    const docs = root.getByRole('treeitem', { name: 'docs' });

    await pressKey(page, 'Tab');
    await pressKeys(page, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);
    await expect(docs).toBeFocused();
    await expect(docs).not.toHaveAttribute('aria-selected');

    await pressKey(page, 'Enter');

    await expect(docs).toHaveAttribute('aria-expanded', 'true');
    await expect(docs).not.toHaveAttribute('aria-selected');
  });

  test('selectionMode "multiple" selects rows independently and marks the tree aria-multiselectable', async ({
    page,
  }) => {
    const root = await openStory(page, MULTI_SELECT_STORY_ID);
    const tree = root.getByRole('tree');
    const src = root.getByRole('treeitem', { name: 'src' });
    const app = root.getByRole('treeitem', { name: 'app' });

    await expect(tree).toHaveAttribute('aria-multiselectable', 'true');

    await pressKey(page, 'Tab');
    await pressKey(page, ' ');
    await expect(src).toHaveAttribute('aria-selected', 'true');

    await pressKey(page, 'ArrowDown');
    await pressKey(page, ' ');

    await expect(app).toHaveAttribute('aria-selected', 'true');
    await expect(src).toHaveAttribute('aria-selected', 'true');
  });

  test('the lazy tree shows a loading state, then its root rows', async ({ page }) => {
    const root = await openStory(page, LAZY_LOADING_STORY_ID);

    await expect(root.getByRole('treeitem', { name: 'Loading…' })).toBeVisible();

    await expect(root.getByRole('treeitem', { name: 'docs' })).toBeVisible({ timeout: 3_000 });
    await expect(root.getByRole('treeitem', { name: 'Loading…' })).toHaveCount(0);
  });

  test('an expanding branch that fails to load shows its message and reloads when activated again', async ({
    page,
  }) => {
    const root = await openStory(page, LAZY_LOADING_STORY_ID);

    await expect(root.getByRole('treeitem', { name: 'docs' })).toBeVisible({ timeout: 3_000 });
    const assets = root.getByRole('treeitem', { name: 'assets' });
    await expect(assets).toBeVisible({ timeout: 3_000 });

    await assets.click();

    await expect(root.getByText('Could not reach the file service')).toBeVisible({ timeout: 3_000 });
    await expect(root.getByText('select to retry')).toBeVisible();

    await assets.click();

    await expect(assets).toHaveAttribute('aria-busy', 'true');
    await expect(root.getByText('Could not reach the file service')).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('tree / chrome', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard driven');

  test('a collapsed chevron points at its branch, an expanded one points down, and a leaf has none', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, DEFAULT_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });
    const docs = root.getByRole('treeitem', { name: 'docs' });

    expect(await chevronRotation(src)).toBe('180deg');
    expect(await chevronRotation(docs)).toBe('90deg');
    await expect(root.getByRole('treeitem', { name: 'README.md' }).locator('.et-tree-node-chevron')).toHaveCount(0);

    await docs.click();

    await expect(docs).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => chevronRotation(docs)).toBe('180deg');
  });

  test('each level pushes its label one indent further in, and leaves line up with branches', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const src = await labelEdges(root.getByRole('treeitem', { name: 'src' }));
    const app = await labelEdges(root.getByRole('treeitem', { name: 'app' }));
    const mainTs = await labelEdges(root.getByRole('treeitem', { name: 'main.ts' }));
    const readme = await labelEdges(root.getByRole('treeitem', { name: 'README.md' }));

    expect(app.left - src.left).toBe(INDENT_PX);
    expect(mainTs.left).toBe(app.left);
    expect(readme.left).toBe(src.left);
  });

  test('the focused row scrolls into view inside a scrolling tree', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const tree = root.locator('.et-tree');

    await constrainTreeHeight(root, 80);
    expect(await rowInsideTree(root, 'README.md')).toBe(false);

    await pressKey(page, 'Tab');
    await pressKey(page, 'End');

    await expect(root.getByRole('treeitem', { name: 'README.md' })).toBeFocused();
    await expect.poll(() => rowInsideTree(root, 'README.md')).toBe(true);

    await pressKey(page, 'Home');

    await expect.poll(() => tree.evaluate((el) => el.scrollTop)).toBe(0);
    expect(await rowInsideTree(root, 'src')).toBe(true);
  });

  test('multiple mode ticks the check box of a selected row without shifting its label', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, MULTI_SELECT_STORY_ID);
    const src = root.getByRole('treeitem', { name: 'src' });
    const app = root.getByRole('treeitem', { name: 'app' });
    const before = await labelEdges(src);

    expect((await checkMark(src)).markOpacity).toBe('0');

    await pressKey(page, 'Tab');
    await pressKey(page, ' ');

    await expect(src).toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => (await checkMark(src)).markOpacity).toBe('1');
    expect((await checkMark(src)).background).not.toBe((await checkMark(app)).background);
    expect((await checkMark(app)).markOpacity).toBe('0');
    expect(await labelEdges(src)).toEqual(before);
  });
});

test.describe('tree / rtl', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('ArrowLeft expands and ArrowRight collapses when the tree reads right-to-left', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const docs = root.getByRole('treeitem', { name: 'docs' });

    await setTreeDirection(root, 'rtl');
    await pressKey(page, 'Tab');
    await pressKeys(page, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);
    await expect(docs).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(docs).toHaveAttribute('aria-expanded', 'false');

    await pressKey(page, 'ArrowLeft');
    await expect(docs).toHaveAttribute('aria-expanded', 'true');

    await pressKey(page, 'ArrowLeft');
    await expect(root.getByRole('treeitem', { name: 'getting-started.md' })).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(docs).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(docs).toHaveAttribute('aria-expanded', 'false');
  });

  test('the chevron and the indent mirror under right-to-left', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, DEFAULT_STORY_ID);

    await setTreeDirection(root, 'rtl');

    const src = await labelEdges(root.getByRole('treeitem', { name: 'src' }));
    const app = await labelEdges(root.getByRole('treeitem', { name: 'app' }));

    expect(src.right - app.right).toBe(INDENT_PX);
    await expect.poll(() => chevronRotation(root.getByRole('treeitem', { name: 'docs' }))).toBe('-90deg');
    expect(await chevronRotation(root.getByRole('treeitem', { name: 'src' }))).toBe('180deg');
  });
});

test.describe('tree / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on a branch row, including its chevron, expands and selects it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const docs = root.getByRole('treeitem', { name: 'docs' });
    const chevron = docs.locator('.et-tree-node-chevron');

    await tap(chevron);

    await expect(docs).toHaveAttribute('aria-expanded', 'true');
    await expect(docs).toHaveAttribute('aria-selected', 'true');
  });

  test('a tap on a leaf row selects it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const readme = root.getByRole('treeitem', { name: 'README.md' });

    await tap(readme);

    await expect(readme).toHaveAttribute('aria-selected', 'true');
  });
});
