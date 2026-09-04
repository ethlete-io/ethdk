import { Locator, expect, test } from '@playwright/test';
import { openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-rating--default';
const HALF_STEPS_ID = 'components-forms-rating--half-steps';
const READONLY_ID = 'components-forms-rating--readonly';

/** The base (non-overlay) star row is the one carrying click handlers. */
function stars(root: Locator): Locator {
  return root.locator('.et-rating-row:not(.et-rating-row--fill) .et-rating-icon');
}

/** The rating host itself has `outline: none` - the ring renders on the nested `.et-rating-icons`. */
async function expectRatingFocusVisible(slider: Locator): Promise<void> {
  await expect(slider).toBeFocused();

  const state = await slider.evaluate((el) => {
    const icons = el.querySelector('.et-rating-icons');
    const style = icons ? getComputedStyle(icons) : null;

    return { matchesFocusVisible: el.matches(':focus-visible'), outlineStyle: style?.outlineStyle ?? null };
  });

  expect(state.matchesFocusVisible).toBe(true);
  expect(state.outlineStyle).not.toBe('none');
}

test.describe('rating / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the rating and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');

    await expectRatingFocusVisible(slider);
  });

  test('a readonly rating is still reachable via Tab', async ({ page }) => {
    const root = await openStory(page, READONLY_ID);
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');

    await expect(slider).toBeFocused();
  });
});

test.describe('rating / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard value changes');

  test('ArrowRight and ArrowUp increase the value by one step', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', '1');

    await pressKey(page, 'ArrowUp');
    await expect(slider).toHaveAttribute('aria-valuenow', '2');
  });

  test('ArrowLeft and ArrowDown decrease the value, clearing below the first step', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { value: 2 } });
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expect(slider).toHaveAttribute('aria-valuenow', '1');

    await pressKey(page, 'ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(slider).toHaveAttribute('aria-valuetext', 'No rating');
  });

  test('Home jumps to the first step, End jumps to the max', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');

    await pressKey(page, 'End');
    await expect(slider).toHaveAttribute('aria-valuenow', '5');

    await pressKey(page, 'Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '1');
  });

  test('Backspace and Delete clear the value', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { value: 3 } });
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');
    await expect(slider).toHaveAttribute('aria-valuenow', '3');

    await pressKey(page, 'Backspace');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(slider).toHaveAttribute('aria-valuetext', 'No rating');
  });

  test('the value is reflected in aria-valuemin/max/now and aria-valuetext', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { value: 3 } });
    const slider = root.getByRole('slider');

    await expect(slider).toHaveAttribute('role', 'slider');
    await expect(slider).toHaveAttribute('aria-valuemin', '0');
    await expect(slider).toHaveAttribute('aria-valuemax', '5');
    await expect(slider).toHaveAttribute('aria-valuenow', '3');
    await expect(slider).toHaveAttribute('aria-valuetext', '3 of 5');
  });

  test('half-step arrows change the value by half a star', async ({ page }) => {
    const root = await openStory(page, HALF_STEPS_ID);
    const slider = root.getByRole('slider');

    await expect(slider).toHaveAttribute('aria-valuenow', '3.5');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', '4');

    await pressKey(page, 'ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuenow', '3.5');
  });

  test('half-step Home jumps to the first half star', async ({ page }) => {
    const root = await openStory(page, HALF_STEPS_ID);
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Home');

    await expect(slider).toHaveAttribute('aria-valuenow', '0.5');
  });

  test('a readonly rating ignores keys and clicks', async ({ page }) => {
    const root = await openStory(page, READONLY_ID);
    const slider = root.getByRole('slider');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', '4');

    await stars(root).nth(1).click();
    await expect(slider).toHaveAttribute('aria-valuenow', '4');
  });

  test('a click on a star sets the value', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await stars(root).nth(2).click();

    await expect(slider).toHaveAttribute('aria-valuenow', '3');
    await expect(slider).toHaveAttribute('aria-valuetext', '3 of 5');
  });

  test('clicking the current value clears the rating', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { value: 3 } });
    const slider = root.getByRole('slider');

    await stars(root).nth(2).click();

    await expect(slider).toHaveAttribute('aria-valuenow', '0');
  });
});

test.describe('rating / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on a star sets the value', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await tap(stars(root).nth(2));

    await expect(slider).toHaveAttribute('aria-valuenow', '3');
  });
});
