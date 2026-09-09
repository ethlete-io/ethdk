import { Locator, expect, test } from '@playwright/test';
import { at, expectFocusVisible, openStory, pressKey, tabSequence, tap } from '../support';

const STORY_ID = 'components-actions-button-split--default';

interface SplitButtonSegments {
  group: Locator;
  action: Locator;
  trigger: Locator;
}

function firstSplitButton(root: Locator): SplitButtonSegments {
  const group = root.locator('et-split-button').first();

  return {
    group,
    action: group.locator('.et-split-button-action'),
    trigger: group.locator('.et-split-button-trigger'),
  };
}

test.describe('split-button / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches both segments and each shows its focus ring', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { action, trigger } = firstSplitButton(root);

    await pressKey(page, 'Tab');
    await expectFocusVisible(action);

    await pressKey(page, 'Tab');
    await expectFocusVisible(trigger);
  });

  test('the group is exactly two tab stops, action before trigger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { group, trigger } = firstSplitButton(root);

    const stops = await tabSequence(page, 3);

    expect(at(stops, 0).text).toContain('Save changes');
    expect(at(stops, 1).name).toBe('More save options');
    expect(at(stops, 2).text).toContain('Save changes');

    await expect(trigger).not.toBeFocused();
    await expect(group.locator('.et-split-button-action')).not.toBeFocused();
  });

  test('the container carries role="group"', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { group } = firstSplitButton(root);

    await expect(group).toHaveAttribute('role', 'group');
  });

  test('both segments leave the tab order while disabled', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { disabled: true } });
    const { action, trigger } = firstSplitButton(root);

    await expect(action).toBeDisabled();
    await expect(trigger).toBeDisabled();

    await pressKey(page, 'Tab');

    const activeTag = await page.evaluate(() => document.activeElement?.tagName);

    expect(activeTag).toBe('BODY');
  });
});

test.describe('split-button / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter activates the action segment', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { action } = firstSplitButton(root);

    await action.focus();
    await pressKey(page, 'Enter');

    await expect(root.getByText('Last action: Save (xl)')).toBeVisible();
  });

  test('Space activates the action segment', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { action } = firstSplitButton(root);

    await action.focus();
    await pressKey(page, 'Space');

    await expect(root.getByText('Last action: Save (xl)')).toBeVisible();
  });

  test('activating the action segment does not open the menu', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { action } = firstSplitButton(root);

    await action.focus();
    await pressKey(page, 'Enter');
    await page.waitForTimeout(200);

    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('Enter on the trigger segment opens the menu and focuses the first item', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { trigger } = firstSplitButton(root);

    await trigger.focus();
    await pressKey(page, 'Enter');

    await expect(page.getByRole('menu')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'Save as copy' })).toBeFocused();
  });

  test('ArrowDown on the trigger segment opens the menu and focuses the first item', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { trigger } = firstSplitButton(root);

    await trigger.focus();
    await pressKey(page, 'ArrowDown');

    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Save as copy' })).toBeFocused();
  });

  test('Escape closes the menu and returns focus to the trigger segment', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { trigger } = firstSplitButton(root);

    await trigger.focus();
    await pressKey(page, 'Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).not.toHaveAttribute('aria-expanded', 'true');
  });

  test('a menu item activates and closes the menu, leaving the action segment untouched', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { trigger } = firstSplitButton(root);

    await trigger.focus();
    await pressKey(page, 'Enter');
    await expect(page.getByRole('menuitem', { name: 'Save as copy' })).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(page.getByRole('menu')).toBeHidden();
    await expect(root.getByText('Last action: Save as copy')).toBeVisible();
  });
});

test.describe('split-button / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('a tap on the action segment runs the primary action', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { action } = firstSplitButton(root);

    await tap(action);

    await expect(root.getByText('Last action: Save (xl)')).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('a tap on the trigger segment opens the menu', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const { trigger } = firstSplitButton(root);

    await tap(trigger);

    await expect(page.getByRole('menu')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(root.getByText('Last action: -')).toBeVisible();
  });
});
