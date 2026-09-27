import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, tap, touchDrag } from '../support';

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

/** How many stars the fill row currently paints, hover preview included. */
function filledStars(root: Locator): Promise<string> {
  return root
    .locator('.et-rating-icons')
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--_et-rating-fill-icons'));
}

/** A point `fraction` of the way across star `index` from its left edge, vertically centred. */
async function pointOnStar(root: Locator, index: number, fraction: number): Promise<{ x: number; y: number }> {
  const box = await boxOf(stars(root).nth(index));

  return { x: box.x + box.width * fraction, y: box.y + box.height / 2 };
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

test.describe('rating / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover and mouse drag');

  test('hovering a star previews the fill without committing, and leaving restores the value', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { value: 2 } });
    const slider = root.getByRole('slider');

    await expect.poll(() => filledStars(root)).toBe('2');

    const point = await pointOnStar(root, 3, 0.5);
    await page.mouse.move(point.x, point.y);

    await expect.poll(() => filledStars(root)).toBe('4');
    await expect(slider).toHaveAttribute('aria-valuenow', '2');

    await page.mouse.move(0, 0);

    await expect.poll(() => filledStars(root)).toBe('2');
    await expect(slider).toHaveAttribute('aria-valuenow', '2');
  });

  test('a mouse drag across the stars commits where it is released', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await mouseDrag(page, await pointOnStar(root, 0, 0.5), await pointOnStar(root, 3, 0.5));

    await expect(slider).toHaveAttribute('aria-valuenow', '4');
  });

  test('a drag that ends past the last star commits the maximum', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');
    const past = await pointOnStar(root, 4, 1.5);

    await mouseDrag(page, await pointOnStar(root, 1, 0.5), past);

    await expect(slider).toHaveAttribute('aria-valuenow', '5');
  });

  test('with half steps the left half of a star is its half value and the right half its whole one', async ({
    page,
  }) => {
    const root = await openStory(page, HALF_STEPS_ID);
    const slider = root.getByRole('slider');

    const leftHalf = await pointOnStar(root, 1, 0.25);
    await page.mouse.click(leftHalf.x, leftHalf.y);
    await expect(slider).toHaveAttribute('aria-valuenow', '1.5');

    const rightHalf = await pointOnStar(root, 1, 0.75);
    await page.mouse.click(rightHalf.x, rightHalf.y);
    await expect(slider).toHaveAttribute('aria-valuenow', '2');
  });

  test('with half steps a hover on the left half previews half a star', async ({ page }) => {
    const root = await openStory(page, HALF_STEPS_ID);
    const point = await pointOnStar(root, 0, 0.25);

    await page.mouse.move(point.x, point.y);

    await expect.poll(() => filledStars(root)).toBe('0.5');
  });

  test('in RTL the first star is the rightmost one and a click on it rates one', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await slider.evaluate((el) => el.setAttribute('dir', 'rtl'));

    const first = await boxOf(stars(root).nth(0));
    const last = await boxOf(stars(root).nth(4));
    expect(first.x).toBeGreaterThan(last.x);

    const point = await pointOnStar(root, 0, 0.5);
    await page.mouse.click(point.x, point.y);

    await expect(slider).toHaveAttribute('aria-valuenow', '1');
  });

  test('in RTL the fill grows from the right edge', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID, { args: { value: 2 } });
    const slider = root.getByRole('slider');

    await slider.evaluate((el) => el.setAttribute('dir', 'rtl'));

    await expect(root.locator('.et-rating-row--fill')).toHaveCSS('clip-path', /^inset\(0px 0px 0px calc/);
  });
});

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

  test('a horizontal swipe across the stars commits where the finger lifts and drops the preview', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await touchDrag(page, await pointOnStar(root, 0, 0.5), await pointOnStar(root, 3, 0.5));

    await expect(slider).toHaveAttribute('aria-valuenow', '4');
    await expect.poll(() => filledStars(root)).toBe('4');
  });

  test('a vertical swipe over the stars scrolls the page and rates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const slider = root.getByRole('slider');

    await page.evaluate(() => {
      document.body.style.paddingBottom = '300vh';
    });

    const valueBefore = await slider.getAttribute('aria-valuenow');
    const start = await pointOnStar(root, 2, 0.5);
    await touchDrag(page, start, { x: start.x, y: start.y - 300 });

    await expect(slider).toHaveAttribute('aria-valuenow', valueBefore ?? '');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  });
});
