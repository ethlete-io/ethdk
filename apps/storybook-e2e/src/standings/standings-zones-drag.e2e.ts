import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, touchDrag } from '../support';

const STANDINGS_ID = 'components-sports-standings--default';
const PICK_ID = 'components-sports-standings-pick--default';

const ROW = '.et-standings-row';

const names = (root: Locator) => root.locator('.et-standings-pick-list .et-match-participant-name');
const handles = (root: Locator) => root.locator('.et-standings-pick-handle');
const rowSlots = (root: Locator) => root.locator('.et-standings-pick-row');

const zoneBarColor = (row: Locator) =>
  row
    .locator('.et-standings-cell[data-column="position"]')
    .evaluate((el) => getComputedStyle(el, '::before').backgroundColor);

const rgbOf = (color: string) =>
  color
    .match(/\d+(\.\d+)?/g)
    ?.slice(0, 3)
    .map(Number) ?? [];

const centerOf = async (locator: Locator) => {
  const box = await boxOf(locator);

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const trimmed = async (root: Locator) => (await names(root).allInnerTexts()).map((name) => name.trim());

function moved(order: string[], from: number, to: number) {
  const next = [...order];
  const [item] = next.splice(from, 1);

  next.splice(to, 0, item ?? '');

  return next;
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
}

test.describe('standings / zone colours', () => {
  test('each zone paints its bar in its own theme colour, and an unbanded row paints none', async ({ page }) => {
    const root = await openStory(page, STANDINGS_ID);
    const rows = root.locator(ROW);

    const advancing = await zoneBarColor(rows.nth(0));
    const relegated = await zoneBarColor(rows.nth(5));

    expect(advancing).not.toBe(relegated);
    expect(await zoneBarColor(rows.nth(1))).toBe(advancing);
    expect(await zoneBarColor(rows.nth(2))).toBe('rgba(0, 0, 0, 0)');
  });

  test('a banded row is tinted with its zone colour, an unbanded one stays clear', async ({ page }) => {
    const root = await openStory(page, STANDINGS_ID);
    const rows = root.locator(ROW);
    const tintOf = (row: Locator) => row.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(rgbOf(await tintOf(rows.nth(0))).map((v) => Math.round(v * 255))).toEqual(
      rgbOf(await zoneBarColor(rows.nth(0))),
    );
    expect(await tintOf(rows.nth(3))).toBe('rgba(0, 0, 0, 0)');
  });

  test('each legend swatch wears the colour of the bar it explains', async ({ page }) => {
    const root = await openStory(page, STANDINGS_ID);
    const rows = root.locator(ROW);
    const swatches = root.locator('.et-standings-legend-swatch');
    const swatchColors = await swatches.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));

    expect(swatchColors).toEqual([await zoneBarColor(rows.nth(0)), await zoneBarColor(rows.nth(5))]);
  });
});

test.describe('standings / zone notes for assistive tech', () => {
  test('a banded row header is announced with its position and zone, one word gap apart', async ({ page }) => {
    const root = await openStory(page, STANDINGS_ID);
    const headers = root.getByRole('rowheader');

    await expect(headers.nth(0)).toHaveAccessibleName('1 Advances to the playoffs');
    await expect(headers.nth(1)).toHaveAccessibleName('2 Advances to the playoffs Your team');
    await expect(headers.nth(2)).toHaveAccessibleName('3');
    await expect(headers.nth(5)).toHaveAccessibleName('6 Relegated');
  });

  test('a row reads position, zone, then the participant by name alone', async ({ page }) => {
    const root = await openStory(page, STANDINGS_ID);

    await expect(root.locator('table')).toMatchAriaSnapshot(`
      - row /^1 Advances to the playoffs FC Berlin [0-9]/:
        - rowheader "1 Advances to the playoffs"
        - cell "FC Berlin"
    `);
  });
});

test.describe('standings pick / pointer drag', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('dragging a row by its grip onto a lower slot drops it there', async ({ page }) => {
    const root = await openStory(page, PICK_ID);
    const before = await trimmed(root);

    await mouseDrag(page, await centerOf(handles(root).first()), await centerOf(rowSlots(root).nth(2)));

    await expect(root.locator('.et-standings-pick-list')).toHaveAttribute('data-dragging', '');
    await expect(root.locator('.et-standings-pick-card[data-dragging]')).toHaveCount(1);

    await page.mouse.up();

    await expect(names(root)).toHaveText(moved(before, 0, 2));
    await expect(root.locator('.et-standings-pick-list')).not.toHaveAttribute('data-dragging');
  });

  test('dragging a row up past the cut moves it above', async ({ page }) => {
    const root = await openStory(page, PICK_ID);
    const before = await trimmed(root);
    const last = before.length - 1;

    await mouseDrag(page, await centerOf(handles(root).nth(last)), await centerOf(rowSlots(root).first()));
    await page.mouse.up();

    await expect(names(root)).toHaveText(moved(before, last, 0));
  });

  test('the cards between slide aside while the drag is in flight', async ({ page }) => {
    const root = await openStory(page, PICK_ID);
    const cards = root.locator('.et-standings-pick-card');
    const restingY = (await boxOf(cards.nth(1))).y;

    await mouseDrag(page, await centerOf(handles(root).first()), await centerOf(rowSlots(root).nth(2)));

    await expect.poll(async () => (await boxOf(cards.nth(1))).y).toBeLessThan(restingY - 10);

    await page.mouse.up();
  });

  test('a drag dropped back on its own slot leaves the order alone', async ({ page }) => {
    const root = await openStory(page, PICK_ID);
    const before = await trimmed(root);
    const start = await centerOf(handles(root).nth(1));

    await mouseDrag(page, start, { x: start.x, y: start.y + 60 });
    await page.mouse.move(start.x, start.y, { steps: 6 });
    await page.mouse.up();

    await expect(names(root)).toHaveText(before);
  });

  test('under reduced motion the preview does not slide', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, PICK_ID);

    await expect(root.locator('.et-standings-pick-card').first()).toHaveCSS('transition-duration', '0s');
  });
});

test.describe('standings pick / touch drag', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: finger drag');

  test('the grip keeps the page from scrolling under the finger', async ({ page }) => {
    const root = await openStory(page, PICK_ID);

    await expect(handles(root).first()).toHaveCSS('touch-action', 'none');
  });

  test('a finger drag on the grip reorders the row', async ({ page }) => {
    const root = await openStory(page, PICK_ID);
    const before = await trimmed(root);

    await touchDrag(page, await centerOf(handles(root).first()), await centerOf(rowSlots(root).nth(2)));

    await expect(names(root)).toHaveText(moved(before, 0, 2));
  });
});
