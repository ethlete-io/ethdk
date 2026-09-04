import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap } from '../support';

const CHECKBOX_DEFAULT = 'components-forms-checkbox--default';
const CHECKBOX_READONLY = 'components-forms-checkbox--readonly';
const SWITCH_DEFAULT = 'components-forms-switch--default';
const SWITCH_DISABLED = 'components-forms-switch--disabled';
const RADIO_GROUP_DEFAULT = 'components-forms-selection-list-radio-group--default';
const RADIO_GROUP_HORIZONTAL = 'components-forms-selection-list-radio-group--horizontal';
const CHECKBOX_GROUP_DEFAULT = 'components-forms-selection-list-checkbox-group--default';
const SEGMENTED_BUTTON_GROUP_DEFAULT = 'components-forms-selection-list-segmented-button-group--default';

/** The switch and radio family draw the focus ring on a child, not on the focused host. */
async function expectChildFocusVisible(control: Locator, childSelector: string): Promise<void> {
  await expect(control).toBeFocused();

  const state = await control.evaluate((el, selector) => {
    const ring = el.querySelector(selector);
    const style = ring ? getComputedStyle(ring) : null;

    return {
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: style?.outlineStyle ?? 'none',
      outlineColor: style?.outlineColor ?? 'transparent',
    };
  }, childSelector);

  expect(state.matchesFocusVisible).toBe(true);
  expect(state.outlineStyle).not.toBe('none');
  expect(state.outlineColor).not.toBe('transparent');
}

test.describe('choice-inputs / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the checkbox and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_DEFAULT);
    const checkbox = root.getByRole('checkbox').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(checkbox);
  });

  test('Tab reaches the switch and its track shows the focus ring', async ({ page }) => {
    const root = await openStory(page, SWITCH_DEFAULT);
    const toggle = root.getByRole('switch').first();

    await pressKey(page, 'Tab');

    await expectChildFocusVisible(toggle, '.et-switch-track');
  });

  test('Tab reaches the radio group as a single stop, with the ring on the active option', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT);
    const radios = root.getByRole('radio');

    await pressKey(page, 'Tab');

    await expectChildFocusVisible(radios.first(), '.et-radio-circle');

    await pressKey(page, 'Tab');
    await expect(radios.nth(1)).not.toBeFocused();
  });

  test('a disabled control is skipped in the tab order', async ({ page }) => {
    await openStory(page, SWITCH_DISABLED);

    await pressKey(page, 'Tab');

    const active = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(active === 'BODY' || active === null).toBe(true);
  });
});

test.describe('choice-inputs / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Space toggles the checkbox', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_DEFAULT);
    const checkbox = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    await pressKey(page, 'Tab');
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await pressKey(page, ' ');

    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  test('Space toggles the switch', async ({ page }) => {
    const root = await openStory(page, SWITCH_DEFAULT);
    const toggle = root.getByRole('switch', { name: 'Enable notifications' });

    await pressKey(page, 'Tab');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, ' ');

    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('a readonly checkbox stays focusable but does not toggle', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_READONLY);
    const checkbox = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    await pressKey(page, 'Tab');
    await expect(checkbox).toBeFocused();
    await expect(checkbox).toHaveAttribute('aria-readonly', 'true');

    await pressKey(page, ' ');

    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  test('a disabled switch does not toggle on Space even when focused', async ({ page }) => {
    const root = await openStory(page, SWITCH_DISABLED);
    const toggle = root.getByRole('switch').first();

    await toggle.evaluate((el) => (el as HTMLElement).focus());
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, ' ');

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('radio group arrow keys select while roving, wrapping at both ends', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT);
    const red = root.getByRole('radio', { name: 'Red' });
    const green = root.getByRole('radio', { name: 'Green' });
    const blue = root.getByRole('radio', { name: 'Blue' });

    await pressKey(page, 'Tab');
    await expect(red).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(green).toBeFocused();
    await expect(green).toHaveAttribute('aria-checked', 'true');
    await expect(red).toHaveAttribute('aria-checked', 'false');

    await pressKey(page, 'ArrowDown');
    await expect(blue).toBeFocused();
    await expect(blue).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowDown');
    await expect(red).toBeFocused();
    await expect(red).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowUp');
    await expect(blue).toBeFocused();
    await expect(blue).toHaveAttribute('aria-checked', 'true');
  });

  test('all four arrow keys move a horizontal radio group', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_HORIZONTAL);
    const red = root.getByRole('radio', { name: 'Red' });
    const green = root.getByRole('radio', { name: 'Green' });

    await pressKey(page, 'Tab');
    await expect(red).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(green).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(red).toBeFocused();
  });

  test('checkbox group arrow keys move focus only, without changing selection', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_GROUP_DEFAULT);
    const cheese = root.getByRole('checkbox', { name: 'Cheese' });
    const pepperoni = root.getByRole('checkbox', { name: 'Pepperoni' });

    await pressKey(page, 'Tab');
    await expect(cheese).toBeFocused();

    await pressKey(page, 'ArrowDown');

    await expect(pepperoni).toBeFocused();
    await expect(pepperoni).toHaveAttribute('aria-checked', 'false');
    await expect(cheese).toHaveAttribute('aria-checked', 'false');
  });

  test('segmented button group follows the same roving-selection pattern as radio', async ({ page }) => {
    const root = await openStory(page, SEGMENTED_BUTTON_GROUP_DEFAULT);
    const list = root.getByRole('radio', { name: 'List' });
    const grid = root.getByRole('radio', { name: 'Grid' });
    const table = root.getByRole('radio', { name: 'Table' });

    await pressKey(page, 'Tab');
    await expect(list).toBeFocused();
    await expect(list).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowRight');
    await expect(grid).toBeFocused();
    await expect(grid).toHaveAttribute('aria-checked', 'true');
    await expect(list).toHaveAttribute('aria-checked', 'false');

    await pressKey(page, 'ArrowRight');
    await expect(table).toBeFocused();
    await expect(table).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowRight');
    await expect(list).toBeFocused();
    await expect(list).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('choice-inputs / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap toggles the checkbox', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_DEFAULT);
    const checkbox = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    await tap(checkbox);

    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  test('a tap toggles the switch', async ({ page }) => {
    const root = await openStory(page, SWITCH_DEFAULT);
    const toggle = root.getByRole('switch', { name: 'Dark mode' });

    await tap(toggle);

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('a tap selects a radio option', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT);
    const green = root.getByRole('radio', { name: 'Green' });

    await tap(green);

    await expect(green).toHaveAttribute('aria-checked', 'true');
  });
});
