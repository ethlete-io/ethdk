import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, settle, tap, touchDrag } from '../support';

const STORY_ID = 'components-data-display-line-chart--default';
const MULTI_STORY_ID = 'components-data-display-line-chart--multi-series';
const TIME_STORY_ID = 'components-data-display-line-chart--time-axis';
const GAPS_STORY_ID = 'components-data-display-line-chart--gaps';
const STACKED_STORY_ID = 'components-data-display-line-chart--stacked-area';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

function slicesOf(root: Locator): Locator {
  return root.locator('.et-line-chart-slice');
}

function slice(root: Locator, name: string): Locator {
  return root.getByRole('img', { name, exact: true });
}

function tooltipRows(page: Page): Locator {
  return page.getByRole('tooltip').locator('.et-line-chart-tooltip-row');
}

async function expectSliceFocusVisible(sliceLocator: Locator): Promise<void> {
  await expect(sliceLocator).toBeFocused();
  expect(await sliceLocator.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

  const stroke = await sliceLocator
    .locator('.et-line-chart-slice-target')
    .evaluate((el) => getComputedStyle(el).stroke);

  expect(stroke).not.toBe('none');
  expect(stroke).not.toBe('transparent');
  expect(stroke).not.toBe('rgba(0, 0, 0, 0)');
}

async function expectCrosshairShown(sliceLocator: Locator, shown: boolean): Promise<void> {
  await expect
    .poll(() => sliceLocator.locator('.et-line-chart-crosshair').evaluate((el) => getComputedStyle(el).opacity))
    .toBe(shown ? '1' : '0');
}

async function expectTooltipAbovePoint(page: Page, sliceLocator: Locator): Promise<void> {
  const points = sliceLocator.locator('.et-line-chart-slice-point');

  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect
    .poll(async () => {
      const boxes = await Promise.all((await points.all()).map((point) => boxOf(point)));
      const top = boxes.reduce((best, box) => (box.y < best.y ? box : best));
      const arrow = await boxOf(page.locator('.et-overlay--tooltip .et-overlay-arrow'));
      const panel = await boxOf(page.locator('.et-overlay--tooltip'));
      const offCenter = Math.abs(arrow.x + arrow.width / 2 - (top.x + top.width / 2));
      const gap = top.y + top.height / 2 - (panel.y + panel.height);

      return offCenter <= 1 && gap >= 0 && gap <= 14 ? 'above point' : JSON.stringify({ offCenter, gap });
    })
    .toBe('above point');
}

test.describe('line chart / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  test('the plot is one tab stop, and the arrow keys walk the x values', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(slicesOf(root)).toHaveCount(MONTHS.length);
    await expect(root.locator('.et-line-chart-slice[tabindex="0"]')).toHaveCount(1);

    await pressKey(page, 'Tab');
    await expectSliceFocusVisible(slice(root, 'Jan'));

    await pressKey(page, 'ArrowRight');
    await expectSliceFocusVisible(slice(root, 'Feb'));

    await pressKey(page, 'ArrowRight');
    await expectSliceFocusVisible(slice(root, 'Mar'));

    await pressKey(page, 'ArrowLeft');
    await expectSliceFocusVisible(slice(root, 'Feb'));

    await pressKey(page, 'End');
    await expectSliceFocusVisible(slice(root, 'Aug'));

    await pressKey(page, 'ArrowRight');
    await expect(slice(root, 'Aug')).toBeFocused();

    await pressKey(page, 'Home');
    await expectSliceFocusVisible(slice(root, 'Jan'));
  });

  test('Tab leaves the plot from any x, and returns to the x it left', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowRight');
    await expect(slice(root, 'Mar')).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(slicesOf(root).and(page.locator(':focus'))).toHaveCount(0);

    await pressKey(page, 'Shift+Tab');
    await expectSliceFocusVisible(slice(root, 'Mar'));
  });

  test('the tooltip follows the focused x and shows the crosshair', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText('1,240');
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Jan');
    await expectCrosshairShown(slice(root, 'Jan'), true);

    await pressKey(page, 'ArrowRight');
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText('1,580');
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Feb');
    await expectCrosshairShown(slice(root, 'Feb'), true);
    await expectCrosshairShown(slice(root, 'Jan'), false);
  });

  test('the tooltip lists every series at the focused x, in series order', async ({ page }) => {
    const root = await openStory(page, MULTI_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(slice(root, 'Feb')).toBeFocused();

    await expect(page.getByRole('tooltip').locator('.et-line-chart-tooltip-label')).toHaveText('Feb');
    await expect(tooltipRows(page)).toHaveText([/Online\s*940/, /Box office\s*380/, /Partners\s*210/]);
    await expectTooltipAbovePoint(page, slice(root, 'Feb'));
  });

  test('a missing value is left out of the tooltip', async ({ page }) => {
    const root = await openStory(page, GAPS_STORY_ID);

    await slice(root, 'W3').focus();
    await pressKey(page, 'ArrowRight');
    await expect(slice(root, 'W4')).toBeFocused();

    await expect(tooltipRows(page)).toHaveText([/Home\s*21/]);
  });

  test('Escape closes the tooltip of the focused x', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await pressKey(page, 'Tab');
    await expect(tooltip).toBeVisible();

    await pressKey(page, 'Escape');
    await expect(tooltip).toHaveCount(0);
    await expect(slice(root, 'Jan')).toBeFocused();
  });
});

test.describe('line chart / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only');

  test('hovering anywhere in a column snaps the crosshair and the tooltip to its x', async ({ page }) => {
    const root = await openStory(page, MULTI_STORY_ID);
    const april = slice(root, 'Apr');
    const target = await boxOf(april.locator('.et-line-chart-slice-target'));

    await page.mouse.move(target.x + 2, target.y + target.height - 4);

    await expectCrosshairShown(april, true);
    await expect(tooltipRows(page)).toHaveText([/Online\s*1,080/, /Box office\s*520/, /Partners\s*190/]);

    await page.mouse.move(target.x + target.width + 2, target.y + 4);

    await expectCrosshairShown(april, false);
    await expect(page.getByRole('tooltip').locator('.et-line-chart-tooltip-label')).toHaveText('May');
  });

  test('leaving the plot closes the tooltip', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await slice(root, 'Mar').hover();
    await expect(tooltip).toBeVisible();

    await page.mouse.move(2, 2);
    await expect(tooltip).toHaveCount(0);
  });
});

test.describe('line chart / accessibility', () => {
  test('each x is an image named by its x and described by every value', async ({ page }) => {
    const root = await openStory(page, MULTI_STORY_ID);
    const march = slice(root, 'Mar');

    await expect(march).toHaveAccessibleDescription('Online 1,210, Box office 450, Partners 240');
  });

  test('a time axis names each x by its date', async ({ page }) => {
    const root = await openStory(page, TIME_STORY_ID);

    await expect(slice(root, 'Mar 30, 2025')).toHaveAccessibleDescription('530');
    await expect(slicesOf(root)).toHaveCount(28);
  });

  test('the x values sit in a group named by the chart label', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const group = root.getByRole('group', { name: 'Visitors per month' });

    await expect(group).toBeVisible();
    await expect(group.getByRole('img')).toHaveCount(MONTHS.length);
  });

  test('the drawn lines stay out of the accessibility tree', async ({ page }) => {
    const root = await openStory(page, STACKED_STORY_ID);

    await expect(root.locator('.et-line-chart-series-layer')).toHaveAttribute('aria-hidden', 'true');
  });

  test('a multi-series chart names every series in its legend', async ({ page }) => {
    const root = await openStory(page, MULTI_STORY_ID);

    await expect(root.locator('.et-chart-legend-label')).toHaveText(['Online', 'Box office', 'Partners']);
    await expect(root.locator('.et-chart-legend')).toHaveAttribute('data-mark', 'line');
  });
});

test.describe('line chart / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a tap in a column shows the tooltip of its x', async ({ page }) => {
    const root = await openStory(page, MULTI_STORY_ID);
    const march = slice(root, 'Mar');

    await tap(march.locator('.et-line-chart-slice-target'));

    await expect(tooltipRows(page)).toHaveText([/Online\s*1,210/, /Box office\s*450/, /Partners\s*240/]);
    await expectCrosshairShown(march, true);
    await expectTooltipAbovePoint(page, march);
  });

  test('a drag across the plot moves the tooltip to the x under the finger', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');
    const from = await boxOf(slice(root, 'Feb').locator('.et-line-chart-slice-target'));
    const to = await boxOf(slice(root, 'May').locator('.et-line-chart-slice-target'));
    const y = from.y + from.height / 2;

    await touchDrag(page, { x: from.x + from.width / 2, y }, { x: to.x + to.width / 2, y });

    await expect(tooltip).toHaveCount(1);
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('May');
    await expectCrosshairShown(slice(root, 'May'), true);
    await expectCrosshairShown(slice(root, 'Feb'), false);
  });

  test('a tap elsewhere closes the tooltip and hides the crosshair', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');
    const march = slice(root, 'Mar');

    await tap(march.locator('.et-line-chart-slice-target'));
    await expect(tooltip).toBeVisible();

    await tap(root.locator('.et-line-chart-x-axis .et-chart-axis-label').first());
    await settle(page, 400);

    await expect(tooltip).toHaveCount(0);
    await expectCrosshairShown(march, false);
  });
});
