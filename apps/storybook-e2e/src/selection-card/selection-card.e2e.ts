import { Locator, expect, test } from '@playwright/test';
import { boxOf, expectTouchMode, openStory, pressKey, tabUntilFocused, tap } from '../support';

const RADIO_CARD_STORY_ID = 'components-forms-selection-list-radio-group--card';
const RADIO_CARD_SLOTS_STORY_ID = 'components-forms-selection-list-radio-group--card-slots';
const CHECKBOX_GROUP_CARD_STORY_ID = 'components-forms-selection-list-checkbox-group--card';
const CHOICE_FIELD_CARD_STORY_ID = 'components-forms-checkbox--card';
const SWITCH_CARD_STORY_ID = 'components-forms-switch--card';

const CARD = '.et-selection-card';

const cardOf = (control: Locator) =>
  control.locator(
    `xpath=ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " et-selection-card ")][1]`,
  );

/** The card paints one ring around the whole panel; the control inside it paints none. */
async function expectCardFocusVisible(focused: Locator): Promise<void> {
  await expect(focused).toBeFocused();
  expect(await focused.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

  const card = await cardOf(focused).evaluate((el) => getComputedStyle(el).outlineStyle);
  const control = await cardOf(focused)
    .locator('.et-selection-card-control')
    .evaluate((el) => {
      const own = getComputedStyle(el);
      const inner = el.querySelector('[role]');
      const innerStyle = inner ? getComputedStyle(inner) : own;

      return [own, innerStyle].map((style) =>
        style.outlineStyle === 'none' || style.outlineColor === 'rgba(0, 0, 0, 0)' ? 'none' : style.outlineStyle,
      );
    });

  expect(card).toBe('solid');
  expect(control).toEqual(['none', 'none']);
}

const borderColorOf = (card: Locator) => card.evaluate((el) => getComputedStyle(el).borderTopColor);
const labelColorOf = (card: Locator) =>
  card.locator('.et-selection-card-label').evaluate((el) => getComputedStyle(el).color);

test.describe('selection card / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a radio card takes the ring on the panel, not on its circle', async ({ page }) => {
    const root = await openStory(page, RADIO_CARD_STORY_ID);
    const red = root.getByRole('radio', { name: 'Red' });

    await tabUntilFocused(page, red);

    await expectCardFocusVisible(red);
  });

  test('a checkbox option card takes the ring on the panel, not on its box', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_GROUP_CARD_STORY_ID);
    const pepperoni = root.getByRole('checkbox', { name: 'Pepperoni' });

    await tabUntilFocused(page, pepperoni);

    await expectCardFocusVisible(pepperoni);
  });

  test('a choice field card rings the wrapping panel while focus sits on the projected checkbox', async ({ page }) => {
    const root = await openStory(page, CHOICE_FIELD_CARD_STORY_ID);
    const terms = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    await tabUntilFocused(page, terms);

    await expectCardFocusVisible(terms);
  });
});

test.describe('selection card / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard interaction');

  test('ArrowDown selects the next radio card and moves the accent border with it', async ({ page }) => {
    const root = await openStory(page, RADIO_CARD_STORY_ID);
    const red = root.getByRole('radio', { name: 'Red' });
    const green = root.getByRole('radio', { name: 'Green' });

    await tabUntilFocused(page, red);
    const restingBorder = await borderColorOf(green);

    await pressKey(page, 'ArrowDown');

    await expect(green).toBeFocused();
    await expect(green).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => borderColorOf(green)).not.toBe(restingBorder);
  });

  test('Space toggles a checkbox option card', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_GROUP_CARD_STORY_ID);
    const pepperoni = root.getByRole('checkbox', { name: 'Pepperoni' });

    await tabUntilFocused(page, pepperoni);
    await pressKey(page, ' ');

    await expect(pepperoni).toHaveAttribute('aria-checked', 'false');
  });

  test('Space toggles the switch inside a choice field card', async ({ page }) => {
    const root = await openStory(page, SWITCH_CARD_STORY_ID);
    const darkMode = root.getByRole('switch', { name: 'Dark mode' });

    await tabUntilFocused(page, darkMode);
    await pressKey(page, ' ');

    await expect(darkMode).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('selection card / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse interaction');

  test('a click on a radio card description selects it', async ({ page }) => {
    const root = await openStory(page, RADIO_CARD_STORY_ID);
    const blue = root.getByRole('radio', { name: 'Blue' });

    await blue.locator('et-description').click();

    await expect(blue).toHaveAttribute('aria-checked', 'true');
  });

  test('a click on the label end of a choice field card toggles the checkbox at the other end', async ({ page }) => {
    const root = await openStory(page, CHOICE_FIELD_CARD_STORY_ID);
    const terms = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });
    const card = cardOf(terms);
    const box = await boxOf(card);

    await card.click({ position: { x: 6, y: box.height / 2 } });

    await expect(terms).toHaveAttribute('aria-checked', 'true');
  });

  test('a selected card differs from its neighbours by border and label colour', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_GROUP_CARD_STORY_ID);
    const cheese = cardOf(root.getByRole('checkbox', { name: 'Cheese' }));
    const pepperoni = cardOf(root.getByRole('checkbox', { name: 'Pepperoni' }));

    expect(await borderColorOf(pepperoni)).not.toBe(await borderColorOf(cheese));
    expect(await labelColorOf(pepperoni)).not.toBe(await labelColorOf(cheese));
  });

  test('by default the control trails the trailing slot', async ({ page }) => {
    const root = await openStory(page, RADIO_CARD_SLOTS_STORY_ID);
    const card = root.getByRole('radio', { name: 'Team' });
    const control = await boxOf(card.locator('.et-selection-card-control'));
    const trailing = await boxOf(card.locator('[etSelectionCardTrailing]'));

    expect(control.x).toBeGreaterThan(trailing.x);
  });

  test('controlPosition start puts the control ahead of the leading slot', async ({ page }) => {
    const root = await openStory(page, RADIO_CARD_SLOTS_STORY_ID, { args: { controlPosition: 'start' } });
    const card = root.getByRole('radio', { name: 'Team' });
    const control = await boxOf(card.locator('.et-selection-card-control'));
    const leading = await boxOf(card.locator('[etSelectionCardLeading]'));

    expect(control.x).toBeLessThan(leading.x);
  });
});

test.describe('selection card / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on a radio card description selects it', async ({ page }) => {
    const root = await openStory(page, RADIO_CARD_STORY_ID);
    const green = root.getByRole('radio', { name: 'Green' });

    await expectTouchMode(page);
    await tap(green.locator('et-description'));

    await expect(green).toHaveAttribute('aria-checked', 'true');
  });

  test('a tap on a checkbox option card toggles it', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_GROUP_CARD_STORY_ID);
    const mushrooms = root.getByRole('checkbox', { name: 'Mushrooms' });

    await tap(mushrooms.locator('.et-selection-card-label'));

    await expect(mushrooms).toHaveAttribute('aria-checked', 'true');
  });

  test('a tap on the label end of a choice field card toggles its switch', async ({ page }) => {
    const root = await openStory(page, SWITCH_CARD_STORY_ID);
    const darkMode = root.getByRole('switch', { name: 'Dark mode' });

    const card = cardOf(darkMode);
    const box = await boxOf(card);

    await card.tap({ position: { x: 6, y: box.height / 2 } });

    await expect(darkMode).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('selection card / plain', () => {
  test('the plain variant never mounts the card chrome', async ({ page }) => {
    await openStory(page, 'components-forms-selection-list-radio-group--default');

    await expect(page.locator(CARD)).toHaveCount(0);
  });
});
