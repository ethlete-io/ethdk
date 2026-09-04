import { expect, test } from '@playwright/test';
import { expectFieldFocusVisible, expectTouchMode, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-forms-cascader--default';

test.describe('cascader / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the trigger and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(trigger);
  });
});

test.describe('cascader / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('Enter opens the panel and focuses the first root node', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');
    const euro = page.getByRole('treeitem', { name: 'UEFA Euro' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(euro).toBeFocused();
  });

  test('ArrowRight drills into the focused branch and focuses its first child', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);
    const euro = page.getByRole('treeitem', { name: 'UEFA Euro' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(euro).toBeFocused();
    await pressKey(page, 'ArrowRight');

    const groupStage = page.getByRole('treeitem', { name: 'Group stage' });

    await expect(groupStage).toBeFocused();
    await expect(groupStage).toHaveAttribute('aria-level', '2');
  });

  test('ArrowLeft returns focus to the parent column', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);
    const euro = page.getByRole('treeitem', { name: 'UEFA Euro' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(euro).toBeFocused();
    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('treeitem', { name: 'Group stage' })).toBeFocused();
    await pressKey(page, 'ArrowLeft');

    await expect(euro).toBeFocused();
    await expect(euro).toHaveAttribute('aria-level', '1');
  });

  test('Escape closes the panel and restores focus to the trigger', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(page.getByRole('treeitem', { name: 'UEFA Euro' })).toBeFocused();
    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('treeitem', { name: 'Group stage' })).toBeFocused();
    await pressKey(page, 'Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Enter selects a drilled-down leaf and closes the panel', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(page.getByRole('treeitem', { name: 'UEFA Euro' })).toBeFocused();
    await pressKey(page, 'ArrowRight');
    await expect(page.getByRole('treeitem', { name: 'Group stage' })).toBeFocused();
    await pressKey(page, 'ArrowRight');

    await expect(page.getByRole('treeitem', { name: 'Group A' })).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('UEFA Euro / Group stage / Group A');
  });
});

test.describe('cascader / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction and sheet presentation');

  test('the touch project satisfies the coarse-pointer check', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on the trigger opens the panel as a bottom sheet', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await tap(trigger);

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.et-cascader-panel[data-sheet]')).toBeVisible();
  });

  test('tapping a parent node navigates into the next level and keeps focus inside the sheet', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');
    const sheet = page.locator('.et-cascader-panel[data-sheet]');

    await tap(trigger);
    await tap(page.getByRole('treeitem', { name: 'UEFA Euro' }));

    const groupStage = page.getByRole('treeitem', { name: 'Group stage' });

    await expect(groupStage).toBeFocused();
    await expect(sheet).toContainText('Group stage');
    await expect(sheet.locator(':focus')).toHaveCount(1);
  });

  test('the back control returns one level', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await tap(trigger);
    await tap(page.getByRole('treeitem', { name: 'UEFA Euro' }));
    await tap(page.getByRole('button', { name: 'Back' }));

    const euro = page.getByRole('treeitem', { name: 'UEFA Euro' });

    await expect(euro).toBeFocused();
    await expect(page.getByRole('treeitem', { name: 'Group stage' })).toHaveCount(0);
  });

  test('tapping a leaf selects it and closes the sheet', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await tap(trigger);
    await tap(page.getByRole('treeitem', { name: 'UEFA Euro' }));
    await tap(page.getByRole('treeitem', { name: 'Group stage' }));
    await tap(page.getByRole('treeitem', { name: 'Group A' }));

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('UEFA Euro / Group stage / Group A');
  });
});
