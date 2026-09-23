import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, settle, tabSequence } from '../support';

const STORY_ID = 'components-data-display-pie-chart--default';
const DONUT_TOTAL_STORY_ID = 'components-data-display-pie-chart--donut-total';
const WITH_ZERO_STORY_ID = 'components-data-display-pie-chart--with-zero';
const SINGLE_STORY_ID = 'components-data-display-pie-chart--single-slice';
const DEVICES = ['Mobile', 'Desktop', 'Tablet', 'Smart TV'];

type Point = { x: number; y: number };

function slice(root: Locator, label: string): Locator {
  return root.getByRole('img', { name: label, exact: true });
}

async function centerOf(root: Locator): Promise<Point> {
  const svg = await boxOf(root.locator('.et-pie-chart-svg'));

  return { x: svg.x + svg.width / 2, y: svg.y + svg.height / 2 };
}

async function anchorOf(sliceLocator: Locator): Promise<Point> {
  const anchor = await boxOf(sliceLocator.locator('.et-pie-chart-slice-anchor'));

  return { x: anchor.x, y: anchor.y };
}

async function pointInside(root: Locator, sliceLocator: Locator): Promise<Point> {
  const center = await centerOf(root);
  const anchor = await anchorOf(sliceLocator);

  return { x: anchor.x + (center.x - anchor.x) / 3, y: anchor.y + (center.y - anchor.y) / 3 };
}

async function hoverSlice(page: Page, root: Locator, label: string): Promise<void> {
  const point = await pointInside(root, slice(root, label));

  await page.mouse.move(point.x, point.y);
}

async function tapSlice(page: Page, root: Locator, label: string): Promise<void> {
  const point = await pointInside(root, slice(root, label));

  await page.touchscreen.tap(point.x, point.y);
  await settle(page, 50);
}

async function expectTooltipFor(page: Page, expected: { value: string; label: string }): Promise<void> {
  const tooltip = page.getByRole('tooltip');

  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCount(1);
  await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText(expected.value);
  await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText(expected.label);
}

type Side = 'top' | 'right' | 'bottom' | 'left';

const GAP_TO_ANCHOR: Record<Side, (anchor: Point, panel: Awaited<ReturnType<typeof boxOf>>) => number> = {
  top: (anchor, panel) => anchor.y - (panel.y + panel.height),
  right: (anchor, panel) => panel.x - anchor.x,
  bottom: (anchor, panel) => panel.y - anchor.y,
  left: (anchor, panel) => anchor.x - (panel.x + panel.width),
};

const TOOLTIP_GAP_MAX = 12;

async function expectTooltipBeside(page: Page, sliceLocator: Locator, side: Side): Promise<void> {
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect
    .poll(async () => {
      const anchor = await anchorOf(sliceLocator);
      const panel = await boxOf(page.locator('.et-overlay--tooltip'));
      const gap = Math.round(GAP_TO_ANCHOR[side](anchor, panel));

      return gap >= 0 && gap <= TOOLTIP_GAP_MAX ? side : `gap ${gap} on ${side}`;
    })
    .toBe(side);
}

async function expectSliceFocusVisible(sliceLocator: Locator): Promise<void> {
  await expect(sliceLocator).toBeFocused();
  expect(await sliceLocator.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

  const stroke = await sliceLocator.locator('.et-pie-chart-slice-mark').evaluate((el) => getComputedStyle(el).stroke);

  expect(['none', 'transparent', 'rgba(0, 0, 0, 0)']).not.toContain(stroke);
}

test.describe('pie chart / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  test('every slice is a tab stop, and Tab walks them in data order', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.locator('.et-pie-chart-slice')).toHaveCount(DEVICES.length);

    const sequence = await tabSequence(page, DEVICES.length);

    expect(sequence.map((step) => step.name)).toEqual(DEVICES);
  });

  test('a slice of 0 is no tab stop', async ({ page }) => {
    await openStory(page, WITH_ZERO_STORY_ID);

    const sequence = await tabSequence(page, 3);

    expect(sequence.map((step) => step.name)).toEqual(['First half', 'Second half', 'Penalties']);
  });

  test('a keyboard-focused slice shows its focus ring and its tooltip with value and share', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await expectSliceFocusVisible(slice(root, 'Mobile'));
    await expectTooltipFor(page, { value: '5,820', label: 'Mobile · 57%' });

    await pressKey(page, 'Tab');
    await expectSliceFocusVisible(slice(root, 'Desktop'));
    await expectTooltipFor(page, { value: '3,410', label: 'Desktop · 34%' });
  });

  test('Escape closes the tooltip of the focused slice', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(tooltip).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(tooltip).toBeHidden();
    await expect(slice(root, 'Mobile')).toBeFocused();
  });
});

test.describe('pie chart / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hovering a slice opens its tooltip and leaving closes it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await hoverSlice(page, root, 'Tablet');
    await expectTooltipFor(page, { value: '740', label: 'Tablet · 7%' });

    await page.mouse.move(0, 0);

    await expect(page.getByRole('tooltip')).toBeHidden();
  });

  test('the tooltip opens at the outer arc of a slice, on the side of the circle the slice sits on', async ({
    page,
  }) => {
    const root = await openStory(page, STORY_ID);

    await hoverSlice(page, root, 'Mobile');
    await expectTooltipBeside(page, slice(root, 'Mobile'), 'right');

    await hoverSlice(page, root, 'Tablet');
    await expectTooltipBeside(page, slice(root, 'Tablet'), 'top');
  });

  test('a single slice points its tooltip at the top of the circle', async ({ page }) => {
    const root = await openStory(page, SINGLE_STORY_ID);
    const online = slice(root, 'Online');

    await online.hover();

    await expectTooltipFor(page, { value: '1,280', label: 'Online · 100%' });
    await expectTooltipBeside(page, online, 'top');
  });
});

test.describe('pie chart / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a tap on a slice shows its tooltip, and a tap on another moves it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await tapSlice(page, root, 'Mobile');
    await expectTooltipFor(page, { value: '5,820', label: 'Mobile · 57%' });
    await expectTooltipBeside(page, slice(root, 'Mobile'), 'right');

    await tapSlice(page, root, 'Desktop');
    await expectTooltipFor(page, { value: '3,410', label: 'Desktop · 34%' });
  });

  test('a tap elsewhere closes the tooltip', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await tapSlice(page, root, 'Mobile');
    await expect(tooltip).toBeVisible();

    await root.locator('.et-pie-chart-legend-label').first().tap();
    await settle(page, 400);

    await expect(tooltip).toHaveCount(0);
  });
});

test.describe('pie chart / accessibility', () => {
  test('a slice is an image named by its label and described by its value and share', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const mobile = slice(root, 'Mobile');

    await expect(mobile).toHaveAttribute('role', 'img');
    await expect(mobile).toHaveAccessibleName('Mobile');
    await expect(mobile).toHaveAccessibleDescription('5,820 (57%)');
  });

  test('the slices sit in a group named by the chart label', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.getByRole('group', { name: 'Sessions by device' })).toBeVisible();
  });

  test('the legend lists every slice with its value and share, in data order', async ({ page }) => {
    const root = await openStory(page, WITH_ZERO_STORY_ID);

    await expect(root.locator('.et-pie-chart-legend-label')).toHaveText([
      'First half',
      'Second half',
      'Extra time',
      'Penalties',
    ]);
    await expect(root.locator('.et-pie-chart-legend-value')).toHaveText(['21', '33', '0', '4']);
    await expect(root.locator('.et-pie-chart-legend-percent')).toHaveText(['36%', '57%', '0%', '7%']);
  });

  test('each legend swatch wears the color of its slice', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const swatches = root.locator('.et-pie-chart-legend-swatch');

    for (const [index, label] of DEVICES.entries()) {
      const swatch = await swatches.nth(index).evaluate((el) => getComputedStyle(el).backgroundColor);
      const mark = await slice(root, label)
        .locator('.et-pie-chart-slice-mark')
        .evaluate((el) => getComputedStyle(el).fill);

      expect(swatch).toBe(mark);
    }
  });

  test('a donut shows the formatted total in its hole', async ({ page }) => {
    const root = await openStory(page, DONUT_TOTAL_STORY_ID);

    await expect(root.locator('.et-pie-chart-total')).toHaveText('10,200');
    await expect(root.locator('.et-pie-chart-total-label')).toHaveText('Total');
  });

  test('under reduced motion the slices appear without the fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const root = await openStory(page, STORY_ID);
    const animation = await slice(root, 'Mobile').evaluate((el) => getComputedStyle(el).animationName);

    expect(animation).toBe('none');
  });
});
