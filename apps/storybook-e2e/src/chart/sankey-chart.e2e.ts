import { Locator, Page, expect, test } from '@playwright/test';
import { at, boxOf, openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-data-display-sankey-chart--default';
const SOURCES = ['Tickets', 'Catering', 'Merchandise'];
const MIDDLE = 'Match-day revenue';
const SINKS = ['Stewards and staff', 'Security', 'Pitch and facilities', 'Reserves'];
const NODES = [...SOURCES, MIDDLE, ...SINKS];
const LINKS = [...SOURCES.map((source) => `${source} to ${MIDDLE}`), ...SINKS.map((sink) => `${MIDDLE} to ${sink}`)];

function mark(root: Locator, name: string): Locator {
  return root.getByRole('img', { name, exact: true });
}

function linkMarks(root: Locator): Locator {
  return root.locator('.et-sankey-chart-link');
}

async function linkMidpoint(link: Locator) {
  const anchor = await boxOf(link.locator('.et-sankey-chart-link-anchor'));

  return { x: anchor.x, y: anchor.y + anchor.height / 2 };
}

async function highlightedLinks(root: Locator): Promise<string[]> {
  return root
    .locator('.et-sankey-chart-link[data-highlighted]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('aria-label') ?? ''));
}

async function fillOpacityOf(link: Locator): Promise<number> {
  return Number(await link.locator('.et-sankey-chart-link-mark').evaluate((el) => getComputedStyle(el).fillOpacity));
}

async function expectNodeFocusVisible(node: Locator): Promise<void> {
  await expect(node).toBeFocused();
  expect(await node.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

  const stroke = await node.locator('.et-sankey-chart-node-target').evaluate((el) => getComputedStyle(el).stroke);

  expect(stroke).not.toBe('none');
  expect(stroke).not.toBe('rgba(0, 0, 0, 0)');
}

async function expectNodeTooltip(page: Page, name: string, totals: string[]): Promise<void> {
  const tooltip = page
    .getByRole('tooltip')
    .filter({ has: page.locator('.et-sankey-chart-tooltip-name').getByText(name, { exact: true }) });

  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.et-sankey-chart-tooltip-name')).toHaveText(name);
  await expect(tooltip.locator('.et-sankey-chart-tooltip-total')).toHaveText(totals);
}

async function expectLinkTooltip(page: Page, name: string, value: string): Promise<void> {
  const tooltip = page
    .getByRole('tooltip')
    .filter({ has: page.locator('.et-chart-tooltip-label').getByText(name, { exact: true }) });

  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.et-chart-tooltip-label')).toHaveText(name);
  await expect(tooltip.locator('.et-chart-tooltip-value')).toHaveText(value);
}

async function expectTooltipAboveMidpoint(page: Page, link: Locator): Promise<void> {
  const midpoint = await linkMidpoint(link);

  await expect
    .poll(async () => {
      const arrow = await boxOf(page.locator('.et-overlay--tooltip .et-overlay-arrow'));
      const panel = await boxOf(page.locator('.et-overlay--tooltip'));
      const anchor = await boxOf(link.locator('.et-sankey-chart-link-anchor'));
      const offCenter = Math.abs(arrow.x + arrow.width / 2 - midpoint.x);
      const gap = anchor.y - (panel.y + panel.height);

      return offCenter <= 1 && gap >= 0 && gap <= 10 ? 'above midpoint' : JSON.stringify({ offCenter, gap });
    })
    .toBe('above midpoint');
}

test.describe('sankey chart / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus');

  test('the chart is one tab stop: Tab enters on the first node and the next Tab leaves', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.locator('.et-sankey-chart-node')).toHaveCount(NODES.length);
    await expect(root.locator('.et-sankey-chart-svg [tabindex="0"]')).toHaveCount(1);

    await pressKey(page, 'Tab');
    await expect(mark(root, 'Tickets')).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(root.locator('.et-sankey-chart-svg :focus')).toHaveCount(0);
  });

  test('the arrow keys walk the nodes, down a column and across to the next', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await expectNodeFocusVisible(mark(root, 'Catering'));

    await pressKey(page, 'ArrowRight');
    await expectNodeFocusVisible(mark(root, MIDDLE));
    await expectNodeTooltip(page, MIDDLE, ['In 660', 'Out 660']);

    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowUp');
    await expect(root.locator('.et-sankey-chart-node:focus')).toHaveCount(1);

    await pressKey(page, 'ArrowLeft');
    await expect(mark(root, MIDDLE)).toBeFocused();
  });

  test('Enter steps into the outgoing links, the arrows cycle them and Escape returns', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const outgoing = SINKS.map((sink) => `${MIDDLE} to ${sink}`);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'Enter');

    await expect(mark(root, at(outgoing, 0))).toBeFocused();
    await expectLinkTooltip(page, at(outgoing, 0), '210');
    expect(await highlightedLinks(root)).toEqual([at(outgoing, 0)]);

    await pressKey(page, 'ArrowDown');
    await expect(mark(root, at(outgoing, 1))).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await pressKey(page, 'ArrowUp');
    await expect(mark(root, at(outgoing, 3))).toBeFocused();

    await pressKey(page, 'Escape');
    await expect(mark(root, MIDDLE)).toBeFocused();
    await expectNodeTooltip(page, MIDDLE, ['In 660', 'Out 660']);
    await expect(page.getByRole('tooltip')).toHaveCount(1);
  });

  test('leaving the chart and coming back with Shift+Tab lands on the last focused mark', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'Enter');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Shift+Tab');

    await expect(mark(root, `${MIDDLE} to Security`)).toBeFocused();
  });

  test('a keyboard-focused node shows its focus ring', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await expectNodeFocusVisible(mark(root, 'Tickets'));
  });

  test('focusing a node highlights its links and dims the rest', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(mark(root, MIDDLE)).toBeFocused();

    expect(await highlightedLinks(root)).toEqual(LINKS);

    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'End');
    await pressKey(page, 'Home');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowDown');
    await expect(mark(root, 'Merchandise')).toBeFocused();

    expect(await highlightedLinks(root)).toEqual([`Merchandise to ${MIDDLE}`]);
    await expect.poll(() => fillOpacityOf(mark(root, `Merchandise to ${MIDDLE}`))).toBeCloseTo(0.6);
    await expect.poll(() => fillOpacityOf(mark(root, `Tickets to ${MIDDLE}`))).toBeCloseTo(0.1);
  });

  test('focusing a node opens its tooltip with its label and totals', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await expectNodeTooltip(page, 'Tickets', ['Out 420']);

    await pressKey(page, 'ArrowRight');
    await expectNodeTooltip(page, MIDDLE, ['In 660', 'Out 660']);
    await expect(page.getByRole('tooltip')).toHaveCount(1);
  });

  test('focusing a link opens its tooltip and leaves only it highlighted', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');

    await expect(mark(root, `Catering to ${MIDDLE}`)).toBeFocused();
    await expectLinkTooltip(page, `Catering to ${MIDDLE}`, '150');
    expect(await highlightedLinks(root)).toEqual([`Catering to ${MIDDLE}`]);
  });

  test('Escape closes the tooltip of the focused node', async ({ page }) => {
    await openStory(page, STORY_ID);

    await pressKey(page, 'Tab');
    await expect(page.getByRole('tooltip')).toBeVisible();

    await pressKey(page, 'Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});

test.describe('sankey chart / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hovering a node highlights its links, and leaving clears it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await mark(root, 'Security').hover();

    expect(await highlightedLinks(root)).toEqual([`${MIDDLE} to Security`]);
    await expectNodeTooltip(page, 'Security', ['In 140']);

    await page.mouse.move(1, 1);

    await expect(root.locator('.et-sankey-chart-svg')).not.toHaveAttribute('data-highlight');
  });

  test('hovering a link opens its tooltip above the midpoint of the ribbon', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const link = mark(root, `${MIDDLE} to Reserves`);
    const midpoint = await linkMidpoint(link);

    await page.mouse.move(midpoint.x, midpoint.y);

    await expectLinkTooltip(page, `${MIDDLE} to Reserves`, '190');
    await expectTooltipAboveMidpoint(page, link);
    expect(await highlightedLinks(root)).toEqual([`${MIDDLE} to Reserves`]);
  });
});

test.describe('sankey chart / accessibility', () => {
  test('the marks sit in a group named by the chart label', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(root.getByRole('group', { name: 'Match-day revenue and where it goes (k€)' })).toBeVisible();
  });

  test('every node and link is an image named by its label or its two ends', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    for (const name of [...NODES, ...LINKS]) {
      await expect(mark(root, name)).toHaveCount(1);
    }

    await expect(linkMarks(root)).toHaveCount(LINKS.length);
  });

  test('a node is described by its totals and a link by its value', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await expect(mark(root, MIDDLE)).toHaveAccessibleDescription('In: 660, Out: 660');
    await expect(mark(root, `Tickets to ${MIDDLE}`)).toHaveAccessibleDescription('420');
  });

  test('the table view lists every link', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const rows = root.locator('.et-chart-table tbody tr');

    await expect(rows).toHaveCount(LINKS.length);
    await expect(rows.first()).toHaveText(/Tickets\s*Match-day revenue\s*420/);
  });

  test('under reduced motion the marks appear without a fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const root = await openStory(page, STORY_ID);
    const animation = await root
      .locator('.et-sankey-chart-link-mark')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);

    expect(animation).toBe('none');
  });
});

test.describe('sankey chart / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a tap on a node opens its tooltip and highlights its links', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await tap(mark(root, 'Catering'));

    await expectNodeTooltip(page, 'Catering', ['Out 150']);
    expect(await highlightedLinks(root)).toEqual([`Catering to ${MIDDLE}`]);
  });

  test('a tap on a link opens its tooltip, and a tap on another moves it', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const first = await linkMidpoint(mark(root, `Tickets to ${MIDDLE}`));

    await page.touchscreen.tap(first.x, first.y);
    await expectLinkTooltip(page, `Tickets to ${MIDDLE}`, '420');

    const second = await linkMidpoint(mark(root, `${MIDDLE} to Security`));

    await page.touchscreen.tap(second.x, second.y);
    await expectLinkTooltip(page, `${MIDDLE} to Security`, '140');
    await expect(page.getByRole('tooltip')).toHaveCount(1);
  });

  test('a tap elsewhere closes the tooltip and clears the highlight', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    await tap(mark(root, 'Reserves'));
    await expect(page.getByRole('tooltip')).toBeVisible();

    await tap(root.locator('p').first());

    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(root.locator('.et-sankey-chart-svg')).not.toHaveAttribute('data-highlight');
  });

  test('on a phone the chart keeps its minimum width and scrolls sideways', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const scroller = root.locator('.et-sankey-chart-scroller');
    const size = await scroller.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));

    expect(size.scroll).toBeGreaterThan(size.client);
    expect(size.scroll).toBeGreaterThanOrEqual(480);
  });
});

test.describe('sankey chart / narrow', () => {
  const NARROW_STORY_ID = 'components-data-display-sankey-chart--narrow-screen';
  const SOURCES_NARROW = ['Sponsoring', 'Tickets', 'Media rights', 'Merchandise'];

  test.use({ viewport: { width: 400, height: 900 } });

  async function nodeBox(root: Locator, name: string) {
    return boxOf(mark(root, name).locator('.et-sankey-chart-node-mark'));
  }

  test('below 480px the flow turns vertical and nothing scrolls sideways', async ({ page }) => {
    const root = await openStory(page, NARROW_STORY_ID);
    const chart = root.locator('et-sankey-chart');
    const scroller = root.locator('.et-sankey-chart-scroller');

    await expect(chart).toHaveAttribute('data-direction', 'vertical');

    const size = await scroller.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));

    expect(size.scroll).toBeLessThanOrEqual(size.client);

    const sources = await Promise.all(SOURCES_NARROW.map((name) => nodeBox(root, name)));
    const budget = await nodeBox(root, 'Budget');

    for (const source of sources) {
      expect(source.y).toBeCloseTo(at(sources, 0).y, 0);
      expect(source.height).toBeCloseTo(12, 0);
      expect(budget.y).toBeGreaterThan(source.y + source.height);
    }
  });

  test('labels sit above the first row and below the last, inside the plot', async ({ page }) => {
    const root = await openStory(page, NARROW_STORY_ID);
    const plot = await boxOf(root.locator('.et-sankey-chart-plot'));
    const label = (name: string) => root.locator('.et-sankey-chart-label', { hasText: name });

    for (const name of SOURCES_NARROW) {
      const box = await boxOf(label(name));

      expect(box.y + box.height).toBeLessThanOrEqual((await nodeBox(root, name)).y);
    }

    for (const name of ['Salaries', 'Travel', 'Facilities']) {
      const box = await boxOf(label(name));
      const node = await nodeBox(root, name);

      expect(box.y).toBeGreaterThanOrEqual(node.y + node.height);
    }

    const boxes = await root
      .locator('.et-sankey-chart-label')
      .evaluateAll((labels) => labels.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));

    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(plot.x - 1);
      expect(box.right).toBeLessThanOrEqual(plot.x + plot.width + 1);
    }
  });

  test('the arrow keys follow the turned flow: ↓↑ between rows, ←→ within a row and across links', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'pointer-only: keyboard focus');

    const root = await openStory(page, NARROW_STORY_ID);
    const focusedName = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');

    await pressKey(page, 'Tab');
    const first = await focusedName();

    expect(SOURCES_NARROW).toContain(first);

    await pressKey(page, 'ArrowRight');
    const second = await focusedName();

    expect(SOURCES_NARROW).toContain(second);
    expect((await nodeBox(root, second)).x).toBeGreaterThan((await nodeBox(root, first)).x);

    await pressKey(page, 'ArrowDown');
    await expectNodeFocusVisible(mark(root, 'Budget'));

    await pressKey(page, 'Enter');
    const firstLink = await focusedName();

    expect(firstLink).toMatch(/^Budget to /);

    await pressKey(page, 'ArrowRight');
    const secondLink = await focusedName();
    const anchorX = async (name: string) => (await boxOf(mark(root, name).locator('.et-sankey-chart-link-anchor'))).x;

    expect(secondLink).toMatch(/^Budget to /);
    expect(await anchorX(secondLink)).toBeGreaterThan(await anchorX(firstLink));

    await pressKey(page, 'Escape');
    await expect(mark(root, 'Budget')).toBeFocused();

    await pressKey(page, 'ArrowUp');
    expect(SOURCES_NARROW).toContain(await focusedName());
  });
});
