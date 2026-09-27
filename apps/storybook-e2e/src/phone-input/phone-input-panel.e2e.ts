import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, pressKeys, tap } from '../support';

const DEFAULT_STORY_ID = 'components-forms-phone-input--default';

const countryTrigger = (root: Locator) => root.locator('.et-phone-input-country-trigger');
const numberField = (root: Locator) => root.locator('.et-phone-input-field');
const dialCode = (root: Locator) => root.locator('.et-phone-input-dial-code');
const countrySearch = (page: Page) => page.getByPlaceholder('Search countries');
const activeOption = (page: Page) => page.locator('[role="option"][data-active]');

const flagOf = (iso2: string) =>
  String.fromCodePoint(...[...iso2.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));

async function openPickerByKeyboard(page: Page) {
  await pressKey(page, 'Tab');
  await pressKey(page, 'Enter');
  await expect(countrySearch(page)).toBeFocused();
}

async function expectSearchPointsAtActiveOption(page: Page) {
  const activeId = await activeOption(page).getAttribute('id');

  await expect(countrySearch(page)).toHaveAttribute('aria-activedescendant', activeId ?? '');
}

test.describe('phone-input panel / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('the picker opens with the current country active and lists the preferred countries first', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);
    await openPickerByKeyboard(page);

    const options = page.getByRole('option');

    await expect(options.nth(0)).toContainText('Germany');
    await expect(options.nth(1)).toContainText('Austria');
    await expect(options.nth(2)).toContainText('Switzerland');
    await expect(activeOption(page)).toContainText('Germany');
    await expectSearchPointsAtActiveOption(page);
  });

  test('ArrowDown and ArrowUp move the active option while focus stays in the search box', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);
    await openPickerByKeyboard(page);

    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowDown');

    await expect(activeOption(page)).toContainText('Switzerland');
    await expect(countrySearch(page)).toBeFocused();
    await expectSearchPointsAtActiveOption(page);

    await pressKey(page, 'ArrowUp');

    await expect(activeOption(page)).toContainText('Austria');
    await expectSearchPointsAtActiveOption(page);
  });

  test('Enter commits the active option and hands focus to the number field', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await openPickerByKeyboard(page);

    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(dialCode(root)).toHaveText('+43');
    await expect(numberField(root)).toBeFocused();
  });

  test('a search makes the first match active, and the arrows walk the matches only', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    await openPickerByKeyboard(page);

    await countrySearch(page).pressSequentially('+41');

    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(activeOption(page)).toContainText('Switzerland');

    await pressKey(page, 'ArrowDown');
    await expect(activeOption(page)).toContainText('Switzerland');

    await pressKey(page, 'Enter');

    await expect(dialCode(root)).toHaveText('+41');
    await expect(numberField(root)).toBeFocused();
  });

  test('the active option scrolls into view as the arrows walk past the visible rows', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);
    await openPickerByKeyboard(page);

    await pressKeys(
      page,
      Array.from({ length: 20 }, () => 'ArrowDown'),
    );

    await expect(activeOption(page)).not.toContainText('Germany');
    await expect(activeOption(page)).toBeInViewport();
    await expect(page.getByRole('option').first()).not.toBeInViewport();
  });
});

test.describe('phone-input panel / flags', () => {
  test('the trigger shows the regional-indicator emoji of the current country, hidden from assistive tech', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const flag = root.locator('.et-phone-input-country-flag');

    await expect(flag).toHaveText(flagOf('de'));
    await expect(flag).toHaveAttribute('aria-hidden', 'true');
    expect((await boxOf(flag)).width).toBeGreaterThan(8);
  });

  test('every option carries its own flag, and a pick swaps the trigger flag', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await countryTrigger(root).click();

    const austria = page.getByRole('option', { name: /Austria \+43/ });

    await expect(austria.locator('.et-phone-input-option-flag')).toHaveText(flagOf('at'));
    await expect(
      page.getByRole('option', { name: /Switzerland \+41/ }).locator('.et-phone-input-option-flag'),
    ).toHaveText(flagOf('ch'));

    await austria.click();

    await expect(root.locator('.et-phone-input-country-flag')).toHaveText(flagOf('at'));
  });

  test('the accessible name of an option is the country and its dial code, not the flag', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await countryTrigger(root).click();

    await expect(page.getByRole('option').first()).toHaveAccessibleName('Germany +49');
  });
});

test.describe('phone-input panel / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a search typed on touch filters the list, and a tap on the match commits it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await tap(countryTrigger(root));
    await tap(countrySearch(page));
    await countrySearch(page).pressSequentially('Switzer');

    const match = page.getByRole('option', { name: /Switzerland \+41/ });

    await expect(page.getByRole('option')).toHaveCount(1);

    await tap(match);

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(dialCode(root)).toHaveText('+41');
  });
});
