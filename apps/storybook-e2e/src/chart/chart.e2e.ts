import { Locator, expect, test } from '@playwright/test';
import { openStory, pressKey, settle, tabSequence, tap } from '../support';

const STORY_ID = 'components-data-display-bar-chart--default';
const NEGATIVE_STORY_ID = 'components-data-display-bar-chart--negative';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

function barsOf(root: Locator): Locator {
  return root.locator('.et-bar-chart-bar');
}

function bar(root: Locator, category: string): Locator {
  return root.getByRole('img', { name: category, exact: true });
}

async function expectBarFocusVisible(barLocator: Locator): Promise<void> {
  await expect(barLocator).toBeFocused();
  expect(await barLocator.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

  const stroke = await barLocator.locator('.et-bar-chart-bar-target').evaluate((el) => getComputedStyle(el).stroke);

  expect(stroke).not.toBe('none');
  expect(stroke).not.toBe('transparent');
  expect(stroke).not.toBe('rgba(0, 0, 0, 0)');
}

test.describe('chart / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  test('every bar is a tab stop, and Tab walks them in category order', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(barsOf(root)).toHaveCount(MONTHS.length);

    for (const month of MONTHS) {
      await expect(bar(root, month)).toHaveAttribute('tabindex', '0');
    }

    const sequence = await tabSequence(page, MONTHS.length);

    expect(sequence.map((step) => step.name)).toEqual(MONTHS);
  });

  test('a keyboard-focused bar shows its focus ring', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await expectBarFocusVisible(bar(root, 'Jan'));

    await pressKey(page, 'Tab');
    await expectBarFocusVisible(bar(root, 'Feb'));
  });

  test('focusing a bar opens its tooltip with the value and the category', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(bar(root, 'Jan')).toBeFocused();
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.et-bar-chart-tooltip-value')).toHaveText('1,240');
    await expect(tooltip.locator('.et-bar-chart-tooltip-label')).toHaveText('Jan');

    await pressKey(page, 'Tab');
    await expect(bar(root, 'Feb')).toBeFocused();
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip.locator('.et-bar-chart-tooltip-value')).toHaveText('1,580');
    await expect(tooltip.locator('.et-bar-chart-tooltip-label')).toHaveText('Feb');
  });

  test('a negative bar shows its signed value in the tooltip', async ({ page }) => {
    const root = await openStory(page, NEGATIVE_STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await bar(root, 'Athletic').focus();
    await pressKey(page, 'Tab');
    await expect(bar(root, 'Wanderers')).toBeFocused();

    await expect(tooltip.locator('.et-bar-chart-tooltip-value')).toHaveText('-14');
    await expect(tooltip.locator('.et-bar-chart-tooltip-label')).toHaveText('Wanderers');
  });

  test('Escape closes the tooltip of the focused bar', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(tooltip).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(tooltip).toBeHidden();
    await expect(bar(root, 'Jan')).toBeFocused();
  });

  test('blurring the bar closes its tooltip', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(tooltip).toBeVisible();

    await bar(root, 'Jan').evaluate((el) => (el as SVGGElement).blur());

    await expect(tooltip).toBeHidden();
  });
});

test.describe('chart / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hovering a bar opens its tooltip and leaving closes it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await bar(root, 'Mar').hover();

    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.et-bar-chart-tooltip-value')).toHaveText('2,130');
    await expect(tooltip.locator('.et-bar-chart-tooltip-label')).toHaveText('Mar');

    await page.mouse.move(0, 0);

    await expect(tooltip).toBeHidden();
  });
});

test.describe('chart / accessibility', () => {
  test('a bar is an image named by its category and described by its value', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const march = bar(root, 'Mar');

    await expect(march).toHaveAttribute('role', 'img');
    await expect(march).toHaveAccessibleName('Mar');
    await expect(march).toHaveAccessibleDescription('2,130');
  });

  test('the bars sit in a group named by the chart label', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.getByRole('group', { name: 'Sign-ups per month' })).toBeVisible();
  });
});

async function expectNoColumnTint(barLocator: Locator): Promise<void> {
  const fill = await barLocator.locator('.et-bar-chart-bar-target').evaluate((el) => getComputedStyle(el).fill);

  expect(['none', 'transparent', 'rgba(0, 0, 0, 0)']).toContain(fill);
}

test.describe('chart / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a tap on a bar shows its tooltip with the value and the category', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await tap(bar(root, 'Mar'));

    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.et-bar-chart-tooltip-value')).toHaveText('2,130');
    await expect(tooltip.locator('.et-bar-chart-tooltip-label')).toHaveText('Mar');
  });

  test('a tap on another bar moves the tooltip to it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await tap(bar(root, 'Mar'));
    await expect(tooltip.locator('.et-bar-chart-tooltip-label')).toHaveText('Mar');

    await tap(bar(root, 'Jun'));

    await expect(tooltip).toHaveCount(1);
    await expect(tooltip.locator('.et-bar-chart-tooltip-label')).toHaveText('Jun');
  });

  test('a tap leaves no hover tint on the column, and a tap elsewhere closes the tooltip', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');
    const march = bar(root, 'Mar');

    await tap(march);
    await expect(tooltip).toBeVisible();
    await expectNoColumnTint(march);

    await tap(root.locator('.et-bar-chart-category-label').first());
    await settle(page, 400);

    await expect(tooltip).toHaveCount(0);
    await expectNoColumnTint(march);
  });
});
