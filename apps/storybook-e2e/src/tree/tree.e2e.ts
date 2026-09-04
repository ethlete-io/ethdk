import { expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, pressKeys, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-tree--default';
const DISABLED_STORY_ID = 'components-data-display-tree--disabled';
const MULTI_SELECT_STORY_ID = 'components-data-display-tree--multi-select';
const NAVIGATION_ONLY_STORY_ID = 'components-data-display-tree--navigation-only';
const LAZY_LOADING_STORY_ID = 'components-data-display-tree--lazy-loading';

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
