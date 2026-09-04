import { expect, test } from '@playwright/test';
import { expectFieldFocusVisible, expectFocusVisible, openStory, pressKey, tap } from '../support';

const EDITOR_DEFAULT_ID = 'components-forms-rich-text-editor--default';
const TRIGGERS_DEFAULT_ID = 'components-forms-rich-text-editor-triggers--default';
const ML_WITH_TRANSLATIONS_ID = 'components-forms-rich-text-editor-multi-language--with-existing-translations';

test.describe('rich-text-editor / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the toolbar on a control and the focus ring is visible', async ({ page }) => {
    await openStory(page, EDITOR_DEFAULT_ID);

    await pressKey(page, 'Tab');

    const focused = page.locator(':focus');
    await expectFocusVisible(focused);
    expect(await focused.evaluate((el) => !!el.closest('[role="toolbar"]'))).toBe(true);
  });

  test('a second Tab moves focus from the toolbar into the editable content', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(content);
  });
});

test.describe('rich-text-editor / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard shortcuts');

  test('ArrowRight moves focus to the next toolbar button, ArrowLeft moves it back', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const bold = root.getByRole('button', { name: 'Bold' });
    const italic = root.getByRole('button', { name: 'Italic' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(bold).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(italic).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(bold).toBeFocused();
  });

  test('Ctrl/Cmd+B wraps the selected text in bold', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('hello');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');

    await expect(content.locator('strong')).toHaveText('hello');
  });

  test('Ctrl/Cmd+Z undoes the bold that was just applied', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('hello');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(content.locator('strong')).toHaveText('hello');

    await page.keyboard.press('ControlOrMeta+z');

    await expect(content.locator('strong')).toHaveCount(0);
    await expect(content).toContainText('hello');
  });

  test('typing a bulleted list prefix converts the line into a list', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('- ');
    await page.keyboard.type('Item');

    await expect(content.locator('ul li')).toHaveText('Item');
  });
});

test.describe('rich-text-editor / triggers keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: token trigger menu');

  test('typing the trigger character opens the token menu with the configured items', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');

    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(4);
    await expect(page.getByRole('option').first()).toHaveText('First name');
  });

  test('ArrowDown moves the active item in the token menu', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await expect(page.getByRole('option').first()).toHaveAttribute('data-active', '');

    await pressKey(page, 'ArrowDown');

    await expect(page.getByRole('option').nth(1)).toHaveAttribute('data-active', '');
    await expect(page.getByRole('option').first()).not.toHaveAttribute('data-active', '');
  });

  test('Escape closes the token menu and leaves the caret usable in the editor', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await expect(page.getByRole('listbox')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(content).toBeFocused();

    await page.keyboard.type('x');
    await expect(content).toContainText('#x');
  });

  test('Enter inserts the active item as a token chip and closes the menu', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await expect(page.getByRole('listbox')).toBeVisible();

    await pressKey(page, 'Enter');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(content.locator('.et-rte-token')).toHaveCount(1);
    await expect(content.locator('.et-rte-token')).toContainText('First name');
  });
});

test.describe('rich-text-editor / multi-language', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: language switcher menu');

  test('the language switcher shows the active language and lists every configured language', async ({ page }) => {
    const root = await openStory(page, ML_WITH_TRANSLATIONS_ID);

    await expect(root.locator('.et-ml-rte-lang-trigger-code')).toHaveText('en');

    await root.locator('.et-ml-rte-lang-trigger').click();

    await expect(page.getByRole('menuitemradio', { name: /English/ })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: /Deutsch/ })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: /Français/ })).toBeVisible();
  });

  test('picking another language switches the active editor to its content', async ({ page }) => {
    const root = await openStory(page, ML_WITH_TRANSLATIONS_ID);
    const content = root.locator('.et-rte-content');

    await expect(content).toContainText('Welcome');

    await root.locator('.et-ml-rte-lang-trigger').click();
    await page.getByRole('menuitemradio', { name: /Deutsch/ }).click();

    await expect(content).toContainText('Willkommen');
    await expect(root.locator('.et-ml-rte-lang-trigger-code')).toHaveText('de');
  });
});

test.describe('rich-text-editor / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the editable region focuses it', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await tap(content);

    await expect(content).toBeFocused();
  });

  test('a tap on a toolbar button activates it', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');
    const headingTrigger = root.getByRole('button', { name: 'Text style: Normal' });

    await tap(content);
    await tap(headingTrigger);

    await expect(headingTrigger).toHaveAttribute('aria-expanded', 'true');
  });
});
