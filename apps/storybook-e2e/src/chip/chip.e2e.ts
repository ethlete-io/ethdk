import { expect, test } from '@playwright/test';
import { expectFocusVisible, focusedDescriptor, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-chip--default';
const FILTER_CHIPS_STORY_ID = 'components-data-display-chip--filter-chips';
const NOT_REMOVABLE_STORY_ID = 'components-data-display-chip--not-removable';
const DISABLED_STORY_ID = 'components-data-display-chip--disabled';

test.describe('chip / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab visits each chip remove button, not the chip host', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const removeButtons = root.locator('.et-chip-remove-button');

    await pressKey(page, 'Tab');
    await expect(removeButtons.nth(0)).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(removeButtons.nth(1)).toBeFocused();
  });

  test('the focus ring is visible on a focused remove button', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const removeButtons = root.locator('.et-chip-remove-button');

    await pressKey(page, 'Tab');

    await expectFocusVisible(removeButtons.first());
  });

  test('a not-removable chip renders no remove button and is not reachable by Tab', async ({ page }) => {
    const root = await openStory(page, NOT_REMOVABLE_STORY_ID);

    await expect(root.locator('.et-chip-remove-button')).toHaveCount(0);

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
  });
});

test.describe('chip / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard removal');

  test('Enter on a focused remove button removes the chip', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect(root.getByText('Design', { exact: true })).toHaveCount(0);
  });

  test('Space on a focused remove button removes the chip', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, ' ');

    await expect(root.getByText('Design', { exact: true })).toHaveCount(0);
  });

  test('Backspace on a focused remove button also removes the chip', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Backspace');

    await expect(root.getByText('Design', { exact: true })).toHaveCount(0);
  });

  test('a disabled chip is skipped in the tab order and its remove button cannot be activated', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);
    const removeButton = root.locator('.et-chip-remove-button').first();

    await expect(removeButton).toBeDisabled();

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
  });

  test('filter chips (multiple): ArrowRight roves focus without toggling, Space toggles aria-checked', async ({
    page,
  }) => {
    const root = await openStory(page, FILTER_CHIPS_STORY_ID);
    const shoes = root.getByRole('checkbox', { name: 'Shoes' });
    const shirts = root.getByRole('checkbox', { name: 'Shirts' });

    await pressKey(page, 'Tab');
    await expect(shoes).toBeFocused();
    await expect(shoes).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowRight');

    await expect(shirts).toBeFocused();
    await expect(shirts).toHaveAttribute('aria-checked', 'false');
    await expect(shoes).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'Space');

    await expect(shirts).toHaveAttribute('aria-checked', 'true');
  });

  test('filter chips (single): ArrowRight roves focus and selects the next chip', async ({ page }) => {
    const root = await openStory(page, FILTER_CHIPS_STORY_ID);
    const relevance = root.getByRole('radio', { name: 'Relevance' });
    const price = root.getByRole('radio', { name: 'Price' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await expect(relevance).toBeFocused();

    await pressKey(page, 'ArrowRight');

    await expect(price).toBeFocused();
    await expect(price).toHaveAttribute('aria-checked', 'true');
    await expect(relevance).toHaveAttribute('aria-checked', 'false');
  });

  test('readonly filter chips stay focusable but a click does not change the selection', async ({ page }) => {
    const root = await openStory(page, FILTER_CHIPS_STORY_ID, { args: { readonly: true } });
    const shirts = root.getByRole('checkbox', { name: 'Shirts' });

    await shirts.click();

    await expect(shirts).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('chip / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the remove button removes the chip', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const removeButton = root.locator('.et-chip-remove-button').first();

    await tap(removeButton);

    await expect(root.getByText('Design', { exact: true })).toHaveCount(0);
  });

  test('a tap on a multiple-mode filter chip toggles aria-checked', async ({ page }) => {
    const root = await openStory(page, FILTER_CHIPS_STORY_ID);
    const shoes = root.getByRole('checkbox', { name: 'Shoes' });

    await expect(shoes).toHaveAttribute('aria-checked', 'true');

    await tap(shoes);

    await expect(shoes).toHaveAttribute('aria-checked', 'false');
  });

  test('a tap on a single-mode filter chip selects it without toggling off', async ({ page }) => {
    const root = await openStory(page, FILTER_CHIPS_STORY_ID);
    const relevance = root.getByRole('radio', { name: 'Relevance' });
    const price = root.getByRole('radio', { name: 'Price' });

    await tap(price);

    await expect(price).toHaveAttribute('aria-checked', 'true');
    await expect(relevance).toHaveAttribute('aria-checked', 'false');

    await tap(price);

    await expect(price).toHaveAttribute('aria-checked', 'true');
  });
});
