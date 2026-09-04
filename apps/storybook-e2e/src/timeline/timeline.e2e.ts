import { expect, test } from '@playwright/test';
import { focusedDescriptor, openStory } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-timeline--default';
const WITH_MARKERS_STORY_ID = 'components-data-display-timeline--with-markers';
const COMPACT_STORY_ID = 'components-data-display-timeline--compact';

const ITEM = 'et-timeline-item';
const MARKER = '.et-timeline-item-marker';

const EVENT_LABELS = ['Squad announced', 'Goal by A. Rossi', 'Second yellow for L. Turner', 'Fulltime - 2:1'];
const EVENT_TIMES = ['18:30', "23'", "67'", "90+4'"];

test.describe('timeline / structure', () => {
  test('renders as a list with one listitem per event, in order', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.getByRole('list')).toHaveCount(1);

    const items = root.getByRole('listitem');
    await expect(items).toHaveCount(EVENT_LABELS.length);

    const texts = await items.evaluateAll((els) => els.map((el) => el.querySelector('p')?.textContent?.trim()));
    expect(texts).toEqual(EVENT_LABELS);
  });

  test('the time slot renders above the content, in event order', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const times = root.locator('[etTimelineTime]');

    await expect(times).toHaveCount(EVENT_TIMES.length);
    await expect(times).toHaveText(EVENT_TIMES);
  });

  test('with no marker projected, the marker slot is left empty for the CSS default dot', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const markers = root.locator(MARKER);

    await expect(markers).toHaveCount(EVENT_LABELS.length);

    for (const isEmpty of await markers.evaluateAll((els) => els.map((el) => el.matches(':empty')))) {
      expect(isEmpty).toBe(true);
    }
  });

  test('the with-markers story projects an icon into every marker', async ({ page }) => {
    const root = await openStory(page, WITH_MARKERS_STORY_ID);
    const markers = root.locator(MARKER);

    await expect(markers).toHaveCount(EVENT_LABELS.length);

    for (const icon of await markers.locator('.et-icon').all()) {
      await expect(icon).toBeVisible();
    }
  });

  test('an item scoped to a color theme carries that theme class, an unscoped item inherits', async ({ page }) => {
    const root = await openStory(page, WITH_MARKERS_STORY_ID);
    const items = root.locator(ITEM);

    await expect(items.nth(0)).toHaveClass(/et-color--inherited/);
    await expect(items.nth(1)).toHaveClass(/et-color--success/);
    await expect(items.nth(2)).toHaveClass(/et-color--danger/);
    await expect(items.nth(3)).toHaveClass(/et-color--brand/);
  });

  test('the default story leaves the density tokens at their registered initial values', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const markerSize = await root
      .locator('et-timeline')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--et-timeline-marker-size').trim());

    expect(markerSize).toBe('20px');
  });

  test('the compact story shrinks the density tokens on the host', async ({ page }) => {
    const root = await openStory(page, COMPACT_STORY_ID);
    const markerSize = await root
      .locator('et-timeline')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--et-timeline-marker-size').trim());

    expect(markerSize).toBe('14px');
  });

  test('the compact story omits the description paragraph', async ({ page }) => {
    const root = await openStory(page, COMPACT_STORY_ID);
    const items = root.locator(ITEM);

    await expect(items.first().locator('p')).toHaveCount(1);
  });

  test('the last item draws no rail segment past its marker', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const items = root.locator(ITEM);

    const middleDisplay = await items
      .nth(1)
      .locator('.et-timeline-item-rail')
      .evaluate((el) => getComputedStyle(el, '::before').display);
    const lastDisplay = await items
      .last()
      .locator('.et-timeline-item-rail')
      .evaluate((el) => getComputedStyle(el, '::before').display);

    expect(middleDisplay).not.toBe('none');
    expect(lastDisplay).toBe('none');
  });
});

test.describe('timeline / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('the timeline imposes no keyboard model - Tab does not stop on any item', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await page.keyboard.press('Tab');

    const focused = await focusedDescriptor(page);
    expect(focused.tag).toBe('BODY');
  });
});
