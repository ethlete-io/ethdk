import { expect, test } from '@playwright/test';
import { boxOf, expectTouchMode, openStory, tabSequence, tap, viewportOf } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-stat-tile--default';
const KPI_ROW_STORY_ID = 'components-data-display-stat-tile--kpi-row';
const LOADING_STORY_ID = 'components-data-display-stat-tile--loading';

const TILE = 'et-stat-tile';
const DELTA = '.et-stat-tile-delta';

test.describe('stat-tile / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a tile has no tab stop of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(TILE)).toHaveCount(1);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('a row of tiles adds no tab stops either', async ({ page }) => {
    const root = await openStory(page, KPI_ROW_STORY_ID);

    await expect(root.locator(TILE)).toHaveCount(10);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('the delta arrow and the sparkline are hidden from assistive technology', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator('.et-stat-tile-delta-icon')).toHaveAttribute('aria-hidden', 'true');
    await expect(root.locator('.et-stat-tile-delta-icon')).toHaveAttribute('focusable', 'false');
    await expect(root.locator('et-stat-tile-sparkline svg').first()).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('stat-tile / reading order', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only');

  test('the tile reads label, value, direction, delta and caption as one sentence', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const text = await root.locator(TILE).evaluate((el) => el.textContent?.replace(/\s+/g, ' ').trim());

    expect(text).toMatch(/^Weekly active users 25\.2K Up \+6\.8% vs last week$/i);
  });

  test('the delta direction and sentiment follow the sign and the good direction', async ({ page }) => {
    const root = await openStory(page, KPI_ROW_STORY_ID);
    const deltas = root.locator(TILE).locator(DELTA);

    await expect(deltas.nth(0)).toHaveAttribute('data-direction', 'up');
    await expect(deltas.nth(0)).toHaveAttribute('data-sentiment', 'good');
    await expect(deltas.nth(1)).toHaveAttribute('data-direction', 'up');
    await expect(deltas.nth(1)).toHaveAttribute('data-sentiment', 'bad');
    await expect(deltas.nth(2)).toHaveAttribute('data-direction', 'down');
    await expect(deltas.nth(2)).toHaveAttribute('data-sentiment', 'good');
    await expect(deltas.nth(3)).toHaveAttribute('data-sentiment', 'neutral');
    await expect(deltas.nth(4)).toHaveAttribute('data-sentiment', 'neutral');
  });

  test('a loading tile is busy, keeps its label and hides the sparkline without collapsing it', async ({ page }) => {
    const root = await openStory(page, LOADING_STORY_ID);
    const tile = root.locator(TILE).first();

    await expect(tile).toHaveAttribute('aria-busy', 'true');
    await expect(tile.locator('.et-stat-tile-label')).toHaveText('Revenue');
    await expect(tile.locator('.et-stat-tile-value')).toHaveCount(0);

    const sparkline = tile.locator('et-stat-tile-sparkline');

    await expect(sparkline).toBeHidden();
    expect((await sparkline.evaluate((el) => el.getBoundingClientRect().height)) > 0).toBe(true);
  });
});

test.describe('stat-tile / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a row of tiles fits the phone viewport without horizontal overflow', async ({ page }) => {
    const root = await openStory(page, KPI_ROW_STORY_ID);
    const { width } = viewportOf(page);

    await expect(root.locator(TILE)).toHaveCount(10);

    for (const tile of await root.locator(TILE).all()) {
      const box = await boxOf(tile);

      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('tapping a tile moves no focus into it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await tap(root.locator(TILE));

    const focusedInside = await root.locator(TILE).evaluate((el) => el.contains(document.activeElement));

    expect(focusedInside).toBe(false);
  });
});
