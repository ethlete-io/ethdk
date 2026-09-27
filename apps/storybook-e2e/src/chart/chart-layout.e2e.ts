import { Locator, expect, test } from '@playwright/test';
import { boxOf, openStory, tabSequence } from '../support';

const HORIZONTAL_STORY_ID = 'components-data-display-bar-chart--horizontal';
const SANKEY_STORY_ID = 'components-data-display-sankey-chart--default';

const CATEGORIES = ['Falcons', 'Harbour City', 'Rovers', 'United Athletic Club', 'Wanderers'];
const VALUES = [54, 47, 41, 36, 29];

const barMark = (root: Locator, name: string) =>
  root.getByRole('img', { name, exact: true }).locator('.et-bar-chart-bar-mark');
const categoryLabels = (root: Locator) => root.locator('.et-bar-chart-category-axis .et-chart-axis-label');
const sankeyNode = (root: Locator, name: string) =>
  root.getByRole('img', { name, exact: true }).locator('.et-sankey-chart-node-mark');
const sankeyLabel = (root: Locator, name: string) =>
  root.locator('.et-sankey-chart-label').filter({ hasText: new RegExp(`^${name}$`) });

const middleY = (box: { y: number; height: number }) => box.y + box.height / 2;

async function expectLabelTruncated(label: Locator) {
  await expect(label).toHaveCSS('text-overflow', 'ellipsis');
  expect(await label.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
}

test.describe('bar chart / horizontal layout', () => {
  test('the categories run top to bottom, each label left of the plot and level with its bar', async ({ page }) => {
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const labels = categoryLabels(root);
    const plot = await boxOf(root.locator('.et-bar-chart-plot'));

    await expect(labels).toHaveText(CATEGORIES);

    for (const [index, name] of CATEGORIES.entries()) {
      const label = await boxOf(labels.nth(index));
      const bar = await boxOf(barMark(root, name));

      expect(label.x + label.width).toBeLessThanOrEqual(plot.x + 1);
      expect(middleY(label)).toBeCloseTo(middleY(bar), 0);
    }
  });

  test('the bars grow right from one baseline, their lengths in proportion to the values', async ({ page }) => {
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const boxes = await Promise.all(CATEGORIES.map((name) => boxOf(barMark(root, name))));
    const first = boxes[0];

    expect(new Set(boxes.map((box) => Math.round(box.x)))).toEqual(new Set([Math.round(first?.x ?? 0)]));
    expect((boxes[4]?.width ?? 0) / (first?.width ?? 1)).toBeCloseTo((VALUES[4] ?? 0) / (VALUES[0] ?? 1), 1);
  });

  test('the value axis sits under the plot and counts up from left to right', async ({ page }) => {
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const plot = await boxOf(root.locator('.et-bar-chart-plot'));
    const ticks = root.locator('.et-bar-chart-value-axis .et-chart-axis-label');
    const first = await boxOf(ticks.first());
    const last = await boxOf(ticks.last());

    await expect(ticks.first()).toHaveText('0');
    expect(first.y).toBeGreaterThanOrEqual(plot.y + plot.height - 1);
    expect(last.x).toBeGreaterThan(first.x);
    expect(Number(await ticks.last().textContent())).toBeGreaterThanOrEqual(Math.max(...VALUES));
  });

  test('in a narrow chart the label column stops at 40% and cuts a long name off', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const root = await openStory(page, HORIZONTAL_STORY_ID);
    const chart = await boxOf(root.locator('et-bar-chart'));
    const axis = await boxOf(root.locator('.et-bar-chart-category-axis'));

    expect(axis.width).toBeLessThanOrEqual(chart.width * 0.4 + 1);
    await expectLabelTruncated(categoryLabels(root).filter({ hasText: 'United Athletic Club' }));
  });
});

test.describe('bar chart / horizontal keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab walks the bars from the top category down', async ({ page }) => {
    await openStory(page, HORIZONTAL_STORY_ID);

    const names = (await tabSequence(page, CATEGORIES.length)).map((stop) => stop.name);

    expect(names).toEqual(CATEGORIES);
  });
});

test.describe('sankey chart / labels', () => {
  test('a first-column label sits left of its node, every other label right of it, both centred on it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const root = await openStory(page, SANKEY_STORY_ID);

    const tickets = await boxOf(sankeyNode(root, 'Tickets'));
    const ticketsLabel = await boxOf(sankeyLabel(root, 'Tickets'));
    const revenue = await boxOf(sankeyNode(root, 'Match-day revenue'));
    const revenueLabel = await boxOf(sankeyLabel(root, 'Match-day revenue'));
    const reserves = await boxOf(sankeyNode(root, 'Reserves'));
    const reservesLabel = await boxOf(sankeyLabel(root, 'Reserves'));

    expect(ticketsLabel.x + ticketsLabel.width).toBeLessThanOrEqual(tickets.x);
    expect(revenueLabel.x).toBeGreaterThanOrEqual(revenue.x + revenue.width);
    expect(reservesLabel.x).toBeGreaterThanOrEqual(reserves.x + reserves.width);

    expect(middleY(ticketsLabel)).toBeCloseTo(middleY(tickets), 0);
    expect(middleY(revenueLabel)).toBeCloseTo(middleY(revenue), 0);
    expect(middleY(reservesLabel)).toBeCloseTo(middleY(reserves), 0);
  });

  test('the labels stay inside the plot and out of the accessibility tree', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const root = await openStory(page, SANKEY_STORY_ID);
    const plot = await boxOf(root.locator('.et-sankey-chart-plot'));
    const labels = await root
      .locator('.et-sankey-chart-label')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));

    await expect(root.locator('.et-sankey-chart-labels')).toHaveAttribute('aria-hidden', 'true');
    expect(labels).toHaveLength(8);
    expect(labels.every((box) => box.left >= plot.x - 1 && box.right <= plot.x + plot.width + 1)).toBe(true);
  });

  test('a label longer than its gutter is cut off with an ellipsis, and the node keeps its full name', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const root = await openStory(page, SANKEY_STORY_ID, { args: { labelWidth: 40 } });

    await expectLabelTruncated(sankeyLabel(root, 'Stewards and staff'));
    await expect(root.getByRole('img', { name: 'Stewards and staff', exact: true })).toHaveCount(1);
  });
});
