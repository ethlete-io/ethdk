import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectTouchMode, openStory, settle, touchDrag } from '../support';

const NUMBER_DEFAULT_ID = 'components-forms-number-input--default';
const NUMBER_STEPPER_ID = 'components-forms-number-input--stepper';
const NUMBER_COARSE_ID = 'components-forms-number-input--coarse-and-fine-stepping';
const PASSWORD_DEFAULT_ID = 'components-forms-password-input--default';
const PASSWORD_CAPS_LOCK_ID = 'components-forms-password-input--caps-lock-warning';

const SCRUB_CLASS = 'et-number-input-scrubbing';

const numberField = (root: Locator) => root.locator('.et-number-input-native');
const incrementButton = (root: Locator) => root.getByRole('button', { name: 'Increment' });
const decrementButton = (root: Locator) => root.getByRole('button', { name: 'Decrement' });

const centerOf = async (locator: Locator) => {
  const box = await boxOf(locator);

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const valueOf = async (field: Locator) => Number(await field.inputValue());

const documentIsScrubbing = (page: Page) =>
  page.evaluate((cls) => document.documentElement.classList.contains(cls), SCRUB_CLASS);

async function pressAndHold(page: Page, target: Locator, holdMs: number) {
  const { x, y } = await centerOf(target);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await settle(page, holdMs);
  await page.mouse.up();
}

async function typeWithCapsLock(field: Locator, capsLock: boolean) {
  await field.evaluate((el, on) => {
    for (const type of ['keydown', 'keyup']) {
      el.dispatchEvent(new KeyboardEvent(type, { key: 'A', bubbles: true, modifierCapsLock: on }));
    }
  }, capsLock);
}

test.describe('number input / typing', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hardware keyboard');

  test('Backspace removes one fraction digit and keeps the separator', async ({ page }) => {
    const field = numberField(await openStory(page, NUMBER_DEFAULT_ID));

    await field.click();
    await page.keyboard.type('2.05');
    await page.keyboard.press('Backspace');

    await expect(field).toHaveValue('2.0');
  });

  test('the caret stays at the end while editing a fraction', async ({ page }) => {
    const field = numberField(await openStory(page, NUMBER_DEFAULT_ID));

    await field.click();
    await page.keyboard.type('1.5');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('7');

    await expect(field).toHaveValue('1.7');
  });

  test('a negative number between -1 and 0 can be typed', async ({ page }) => {
    const field = numberField(await openStory(page, NUMBER_DEFAULT_ID));

    await field.click();
    await page.keyboard.type('-0.5');

    await expect(field).toHaveValue('-0.5');
  });

  test('leaving the field writes the number in its plain form', async ({ page }) => {
    const field = numberField(await openStory(page, NUMBER_DEFAULT_ID));

    await field.click();
    await page.keyboard.type('2.0');
    await field.blur();

    await expect(field).toHaveValue('2');
  });

  test('a step while focused rewrites the typed text', async ({ page }) => {
    const field = numberField(await openStory(page, NUMBER_STEPPER_ID));

    await field.click();
    await page.keyboard.type('2.0');
    await page.keyboard.press('ArrowUp');

    await expect(field).toHaveValue('3');
  });
});

test.describe('number input / stepper hold', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse press and hold');

  test('a short click steps once', async ({ page }) => {
    const root = await openStory(page, NUMBER_STEPPER_ID);

    await incrementButton(root).click();
    await settle(page, 600);

    await expect(numberField(root)).toHaveValue('1');
  });

  test('holding a stepper button repeats the step after a delay and stops on release', async ({ page }) => {
    const root = await openStory(page, NUMBER_STEPPER_ID);
    const field = numberField(root);

    await pressAndHold(page, incrementButton(root), 700);

    const released = await valueOf(field);

    expect(released).toBeGreaterThanOrEqual(3);

    await settle(page, 400);

    await expect(field).toHaveValue(String(released));
  });

  test('a hold runs into the max, stops there and disables the exhausted button', async ({ page }) => {
    const root = await openStory(page, NUMBER_STEPPER_ID);

    await pressAndHold(page, incrementButton(root), 1600);

    await expect(numberField(root)).toHaveValue('10');
    await expect(incrementButton(root)).toBeDisabled();
    await expect(decrementButton(root)).toBeEnabled();
  });
});

test.describe('number input / scrub', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: the scrub is a fine-pointer gesture');

  test('a stepper button offers the scrub cursor', async ({ page }) => {
    const root = await openStory(page, NUMBER_COARSE_ID);

    await expect(incrementButton(root)).toHaveCSS('cursor', 'ew-resize');
  });

  test('dragging a stepper button right scrubs the value up, one step per 4px, and wears the scrub cursor', async ({
    page,
  }) => {
    const root = await openStory(page, NUMBER_COARSE_ID);
    const field = numberField(root);
    const { x, y } = await centerOf(incrementButton(root));

    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(field).toHaveValue('1');

    await page.mouse.move(x + 10, y, { steps: 2 });
    await page.mouse.move(x + 50, y + 30, { steps: 10 });

    expect(await documentIsScrubbing(page)).toBe(true);
    await expect(page.locator('body')).toHaveCSS('cursor', 'ew-resize');
    await expect.poll(() => valueOf(field)).toBeGreaterThanOrEqual(9);

    await page.mouse.up();

    expect(await documentIsScrubbing(page)).toBe(false);
    await expect(page.locator('body')).not.toHaveCSS('cursor', 'ew-resize');
  });

  test('dragging left from the increment button scrubs the value down', async ({ page }) => {
    const root = await openStory(page, NUMBER_COARSE_ID);
    const field = numberField(root);
    const { x, y } = await centerOf(incrementButton(root));

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 10, y, { steps: 2 });
    await page.mouse.move(x - 90, y, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => valueOf(field)).toBeLessThanOrEqual(-15);
  });

  test('a scrub stops the hold repeat: holding still after the drag leaves the value alone', async ({ page }) => {
    const root = await openStory(page, NUMBER_COARSE_ID);
    const field = numberField(root);
    const { x, y } = await centerOf(incrementButton(root));

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 30, y, { steps: 6 });

    const afterDrag = await valueOf(field);

    await settle(page, 700);

    await expect(field).toHaveValue(String(afterDrag));

    await page.mouse.up();
  });
});

test.describe('number input / touch stepper', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: coarse pointer');

  test('the stepper buttons refuse to scroll and show no scrub cursor on touch', async ({ page }) => {
    const root = await openStory(page, NUMBER_COARSE_ID);
    await expectTouchMode(page);

    await expect(incrementButton(root)).toHaveCSS('touch-action', 'none');
    await expect(incrementButton(root)).toHaveCSS('cursor', 'pointer');
  });

  test('a sideways touch drag off a stepper button steps once and never scrubs', async ({ page }) => {
    await page.clock.install();
    const root = await openStory(page, NUMBER_COARSE_ID);
    const start = await centerOf(incrementButton(root));

    await page.clock.pauseAt(Date.now() + 1000);
    await touchDrag(page, start, { x: start.x + 80, y: start.y }, { steps: 8, clock: true });
    await page.clock.resume();

    await expect(numberField(root)).toHaveValue('1');
    expect(await documentIsScrubbing(page)).toBe(false);
  });
});

test.describe('password input / reveal icon', () => {
  test('the reveal button swaps its eye icon for the slashed eye and back', async ({ page }) => {
    const root = await openStory(page, PASSWORD_DEFAULT_ID);
    const reveal = root.locator('.et-password-input-reveal');
    const icon = reveal.locator('[aria-hidden="true"]').first();
    const hiddenIcon = await icon.innerHTML();

    await reveal.click();
    await expect(reveal).toHaveAttribute('aria-pressed', 'true');
    await expect(reveal).toHaveAccessibleName('Hide password');
    await expect.poll(() => icon.innerHTML()).not.toBe(hiddenIcon);

    await reveal.click();
    await expect(reveal).toHaveAccessibleName('Show password');
    await expect.poll(() => icon.innerHTML()).toBe(hiddenIcon);
  });
});

test.describe('password input / caps lock', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: a hardware keyboard');

  test('a keystroke with Caps Lock on shows the warning inside the field, and one with it off clears it', async ({
    page,
  }) => {
    const root = await openStory(page, PASSWORD_CAPS_LOCK_ID);
    const field = root.locator('.et-password-input-native');
    const warning = root.getByRole('status').filter({ hasText: 'Caps Lock might be on' });

    await field.focus();
    await typeWithCapsLock(field, true);

    await expect(warning).toBeVisible();

    const frame = await boxOf(root.locator('.et-form-field-control-frame'));
    const icon = await boxOf(warning.locator('[aria-hidden="true"]').first());

    expect(icon.x).toBeGreaterThanOrEqual(frame.x);
    expect(icon.x + icon.width).toBeLessThanOrEqual(frame.x + frame.width);

    await typeWithCapsLock(field, false);

    await expect(warning).toHaveCount(0);
  });

  test('the warning goes away when the field loses focus', async ({ page }) => {
    const root = await openStory(page, PASSWORD_CAPS_LOCK_ID);
    const field = root.locator('.et-password-input-native');
    const warning = root.getByRole('status').filter({ hasText: 'Caps Lock might be on' });

    await field.focus();
    await typeWithCapsLock(field, true);
    await expect(warning).toBeVisible();

    await field.blur();

    await expect(warning).toHaveCount(0);
  });
});
