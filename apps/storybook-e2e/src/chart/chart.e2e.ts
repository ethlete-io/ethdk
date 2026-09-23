import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, pressKey, settle, tabSequence, tap } from '../support';

const STORY_ID = 'components-data-display-bar-chart--default';
const NEGATIVE_STORY_ID = 'components-data-display-bar-chart--negative';
const GROUPED_STORY_ID = 'components-data-display-bar-chart--grouped';
const STACKED_STORY_ID = 'components-data-display-bar-chart--stacked';
const STACKED_NEGATIVE_STORY_ID = 'components-data-display-bar-chart--stacked-negative';
const HORIZONTAL_STORY_ID = 'components-data-display-bar-chart--horizontal';
const TICKET_SERIES = ['Online', 'Box office', 'Partners'];
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

const TOOLTIP_GAP_MAX = 10;

type BarEnd = 'top' | 'bottom' | 'right';

const GAP_TO_BAR_END: Record<BarEnd, (mark: Box, panel: Box) => number> = {
  top: (mark, panel) => mark.y - (panel.y + panel.height),
  bottom: (mark, panel) => panel.y - (mark.y + mark.height),
  right: (mark, panel) => panel.x - (mark.x + mark.width),
};

const CENTER_ALONG_BAR_END: Record<BarEnd, (box: Box) => number> = {
  top: (box) => box.x + box.width / 2,
  bottom: (box) => box.x + box.width / 2,
  right: (box) => box.y + box.height / 2,
};

type Box = Awaited<ReturnType<typeof boxOf>>;

async function tooltipOffsetFromBarEnd(page: Page, barLocator: Locator, end: BarEnd) {
  const mark = await boxOf(barLocator.locator('.et-bar-chart-bar-mark'));
  const panel = await boxOf(page.locator('.et-overlay--tooltip'));
  const arrow = await boxOf(page.locator('.et-overlay--tooltip .et-overlay-arrow'));
  const center = CENTER_ALONG_BAR_END[end];
  const markCenter = center(mark);

  return {
    arrowOffCenter: Math.round(Math.abs(center(arrow) - markCenter)),
    panelOffCenter: Math.round(Math.abs(center(panel) - markCenter)),
    gap: Math.round(GAP_TO_BAR_END[end](mark, panel)),
  };
}

async function expectTooltipAtBarEnd(page: Page, barLocator: Locator, end: BarEnd): Promise<void> {
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect
    .poll(async () => {
      const offset = await tooltipOffsetFromBarEnd(page, barLocator, end);

      return offset.arrowOffCenter <= 1 &&
        offset.panelOffCenter <= 1 &&
        offset.gap >= 0 &&
        offset.gap <= TOOLTIP_GAP_MAX
        ? 'at bar end'
        : JSON.stringify(offset);
    })
    .toBe('at bar end');
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
    await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText('1,240');
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Jan');

    await pressKey(page, 'Tab');
    await expect(bar(root, 'Feb')).toBeFocused();
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText('1,580');
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Feb');
  });

  test('a negative bar shows its signed value in the tooltip', async ({ page }) => {
    const root = await openStory(page, NEGATIVE_STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await bar(root, 'Athletic').focus();
    await pressKey(page, 'Tab');
    await expect(bar(root, 'Wanderers')).toBeFocused();

    await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText('-14');
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Wanderers');
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
    await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText('2,130');
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Mar');

    await page.mouse.move(0, 0);

    await expect(tooltip).toBeHidden();
  });

  test('the tooltip points at the top of the hovered bar, not the top of its column', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const april = bar(root, 'Apr');

    await april.hover();

    await expectTooltipAtBarEnd(page, april, 'top');
  });

  test('a negative bar opens its tooltip below its bottom end', async ({ page }) => {
    const root = await openStory(page, NEGATIVE_STORY_ID);
    const wanderers = bar(root, 'Wanderers');

    await wanderers.hover();

    await expectTooltipAtBarEnd(page, wanderers, 'bottom');
  });

  test('a short bar points its tooltip at its own top', async ({ page }) => {
    const root = await openStory(page, NEGATIVE_STORY_ID);
    const rovers = bar(root, 'Rovers');

    await rovers.hover();

    await expectTooltipAtBarEnd(page, rovers, 'top');
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
    await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText('2,130');
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Mar');
  });

  test('a tap points the tooltip at the top of the bar, not the top of its column', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const april = bar(root, 'Apr');

    await tap(april);

    await expectTooltipAtBarEnd(page, april, 'top');
  });

  test('a tap on a negative bar opens its tooltip below its bottom end', async ({ page }) => {
    const root = await openStory(page, NEGATIVE_STORY_ID);
    const wanderers = bar(root, 'Wanderers');

    await tap(wanderers);

    await expectTooltipAtBarEnd(page, wanderers, 'bottom');
  });

  test('a tap on another bar moves the tooltip to it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');

    await tap(bar(root, 'Mar'));
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Mar');

    await tap(bar(root, 'Jun'));

    await expect(tooltip).toHaveCount(1);
    await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText('Jun');
  });

  test('a tap leaves no hover tint on the column, and a tap elsewhere closes the tooltip', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const tooltip = page.getByRole('tooltip');
    const march = bar(root, 'Mar');

    await tap(march);
    await expect(tooltip).toBeVisible();
    await expectNoColumnTint(march);

    await tap(root.locator('.et-bar-chart-category-axis .et-chart-axis-label').first());
    await settle(page, 400);

    await expect(tooltip).toHaveCount(0);
    await expectNoColumnTint(march);
  });
});

async function expectTooltipFor(page: Page, expected: { value: string; series: string; category: string }) {
  const tooltip = page.getByRole('tooltip');

  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText(expected.value);
  await expect(tooltip.locator('.et-chart-tooltip-series')).toHaveText(expected.series);
  await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText(expected.category);
}

test.describe('chart / series keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  test('Tab walks the bars category by category, and each series within a category', async ({ page }) => {
    await openStory(page, GROUPED_STORY_ID);

    const sequence = await tabSequence(page, 6);

    expect(sequence.map((step) => step.name)).toEqual([
      ...TICKET_SERIES.map((series) => `Jan, ${series}`),
      ...TICKET_SERIES.map((series) => `Feb, ${series}`),
    ]);
  });

  test('Tab walks a stack from the baseline outwards', async ({ page }) => {
    await openStory(page, STACKED_NEGATIVE_STORY_ID);

    const sequence = await tabSequence(page, 4);

    expect(sequence.map((step) => step.name)).toEqual(['Q1, Sponsoring', 'Q1, Tickets', 'Q1, Salaries', 'Q1, Travel']);
  });

  test('a focused series bar shows its focus ring and its own tooltip', async ({ page }) => {
    const root = await openStory(page, GROUPED_STORY_ID);

    await tabSequence(page, 2);

    await expectBarFocusVisible(bar(root, 'Jan, Box office'));
    await expectTooltipFor(page, { value: '410', series: 'Box office', category: 'Jan' });
  });
});

test.describe('chart / series pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hovering a grouped bar opens the tooltip of that series only', async ({ page }) => {
    const root = await openStory(page, GROUPED_STORY_ID);

    await bar(root, 'Mar, Partners').hover();
    await expectTooltipFor(page, { value: '240', series: 'Partners', category: 'Mar' });

    await bar(root, 'Mar, Online').hover();
    await expectTooltipFor(page, { value: '1,210', series: 'Online', category: 'Mar' });
    await expect(page.getByRole('tooltip')).toHaveCount(1);
  });

  test('a grouped bar points its tooltip at its own top', async ({ page }) => {
    const root = await openStory(page, GROUPED_STORY_ID);
    const boxOffice = bar(root, 'Apr, Box office');

    await boxOffice.hover();

    await expectTooltipAtBarEnd(page, boxOffice, 'top');
  });

  test('a stacked segment opens its tooltip at the top of the segment', async ({ page }) => {
    const root = await openStory(page, STACKED_STORY_ID);
    const boxOffice = bar(root, 'May, Box office');

    await boxOffice.hover();

    await expectTooltipFor(page, { value: '470', series: 'Box office', category: 'May' });
    await expectTooltipAtBarEnd(page, boxOffice, 'top');
  });

  test('a negative stacked segment opens its tooltip below its lower end', async ({ page }) => {
    const root = await openStory(page, STACKED_NEGATIVE_STORY_ID);
    const travel = bar(root, 'Q2, Travel');

    await travel.hover();

    await expectTooltipFor(page, { value: '-45', series: 'Travel', category: 'Q2' });
    await expectTooltipAtBarEnd(page, travel, 'bottom');
  });

  test('a horizontal bar opens its tooltip to the right of its data end', async ({ page }) => {
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const rovers = bar(root, 'Rovers');

    await rovers.hover();

    await expect(page.getByRole('tooltip').locator('.et-chart-tooltip-value')).toHaveText('41');
    await expectTooltipAtBarEnd(page, rovers, 'right');
  });
});

test.describe('chart / series legend', () => {
  test('a multi-series chart names every series in its legend, in series order', async ({ page }) => {
    const root = await openStory(page, GROUPED_STORY_ID);

    await expect(root.locator('.et-chart-legend-label')).toHaveText(TICKET_SERIES);
  });

  test('each legend swatch wears the color of its series bars', async ({ page }) => {
    const root = await openStory(page, GROUPED_STORY_ID);
    const swatches = root.locator('.et-chart-legend-swatch');

    for (const [index, series] of TICKET_SERIES.entries()) {
      const swatch = await swatches.nth(index).evaluate((el) => getComputedStyle(el).backgroundColor);
      const mark = await bar(root, `Jan, ${series}`)
        .locator('.et-bar-chart-bar-mark')
        .evaluate((el) => getComputedStyle(el).fill);

      expect(swatch).toBe(mark);
    }
  });

  test('a single-series chart has no legend', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.locator('.et-chart-legend')).toHaveCount(0);
  });
});

test.describe('chart / series touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a tap on a stacked segment shows the tooltip of that segment', async ({ page }) => {
    const root = await openStory(page, STACKED_STORY_ID);
    const partners = bar(root, 'Mar, Partners');

    await tap(partners);

    await expectTooltipFor(page, { value: '240', series: 'Partners', category: 'Mar' });
    await expectTooltipAtBarEnd(page, partners, 'top');
  });

  test('a tap on a horizontal bar opens its tooltip beside its data end', async ({ page }) => {
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const wanderers = bar(root, 'Wanderers');

    await tap(wanderers);

    await expect(page.getByRole('tooltip').locator('.et-chart-tooltip-value')).toHaveText('29');
    await expectTooltipAtBarEnd(page, wanderers, 'right');
  });
});
