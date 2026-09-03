import { expect, test } from '@playwright/test';
import { expectFieldFocusVisible, expectTouchMode, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-forms-select--default';
const PRESELECTED_STORY_ID = 'components-forms-select--preselected';

test.describe('select / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the trigger and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(trigger);
  });
});

test.describe('select / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  for (const key of ['Enter', ' ', 'ArrowDown']) {
    test(`${key === ' ' ? 'Space' : key} opens the listbox`, async ({ page }) => {
      const root = await openStory(page, DEFAULT_STORY_ID);
      const trigger = root.getByRole('combobox');

      await pressKey(page, 'Tab');
      await pressKey(page, key);

      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('listbox')).toBeVisible();
    });
  }

  test('the first option is active on open, ArrowDown moves the active option forward, ArrowUp moves it back', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');
    const apple = page.getByRole('option', { name: 'Apple' });
    const banana = page.getByRole('option', { name: 'Banana' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect(apple).toHaveAttribute('data-active', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', await apple.getAttribute('id'));

    await pressKey(page, 'ArrowDown');
    await expect(banana).toHaveAttribute('data-active', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', await banana.getAttribute('id'));

    await pressKey(page, 'ArrowUp');
    await expect(apple).toHaveAttribute('data-active', 'true');
  });

  test('Enter commits the active option and closes the panel', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(trigger).toContainText('Banana');
  });

  test('Escape closes the panel without changing the selection', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(trigger).toContainText('Pick a fruit');
  });

  test('a printable character commits the first matching option while closed', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await pressKey(page, 'Tab');
    await pressKey(page, 'c');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Cherry');
  });

  test('a printable character moves virtual focus to the first match while open', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');
    const grape = page.getByRole('option', { name: 'Grape' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await pressKey(page, 'g');

    await expect(grape).toHaveAttribute('data-active', 'true');

    await pressKey(page, 'Enter');

    await expect(trigger).toContainText('Grape');
  });

  test('the preselected option is reflected in the trigger text and aria-selected', async ({ page }) => {
    const root = await openStory(page, PRESELECTED_STORY_ID);
    const trigger = root.getByRole('combobox');

    await expect(trigger).toContainText('Banana');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect(page.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'false');
  });
});

test.describe('select / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('the touch project satisfies the coarse-pointer check', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on the trigger opens the panel as the same anchored overlay', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await tap(trigger);

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
  });

  test('a tap on an option selects it and closes the panel', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await tap(trigger);
    await tap(page.getByRole('option', { name: 'Cherry' }));

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Cherry');
  });
});
