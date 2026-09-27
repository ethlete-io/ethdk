import { Locator, expect, test } from '@playwright/test';
import { focusedDescriptor, openStory } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-timeline--default';
const WITH_MARKERS_STORY_ID = 'components-data-display-timeline--with-markers';
const COMPACT_STORY_ID = 'components-data-display-timeline--compact';

const ITEM = 'et-timeline-item';
const MARKER = '.et-timeline-item-marker';

const EVENT_LABELS = ['Squad announced', 'Goal by A. Rossi', 'Second yellow for L. Turner', 'Fulltime - 2:1'];
const EVENT_TIMES = ['18:30', "23'", "67'", "90+4'"];

interface RailSegment {
  lineTop: number;
  lineBottom: number;
  lineCentreX: number;
  markerTop: number;
  markerCentreY: number;
  markerCentreX: number;
}

/** One entry per item: its rail line (null on the last item) and its marker, in viewport pixels. */
function railGeometry(root: Locator): Promise<(RailSegment | null)[]> {
  return root.locator(ITEM).evaluateAll((items) =>
    items.map((item) => {
      const rail = item.querySelector('.et-timeline-item-rail');
      const marker = item.querySelector('.et-timeline-item-marker');

      if (!rail || !marker) return null;

      const railRect = rail.getBoundingClientRect();
      const line = getComputedStyle(rail, '::before');
      const markerRect = marker.getBoundingClientRect();
      const lineTop = railRect.top + parseFloat(line.top);

      return {
        lineTop,
        lineBottom: lineTop + parseFloat(line.height),
        lineCentreX: railRect.left + parseFloat(line.left) + parseFloat(line.width) / 2,
        markerTop: markerRect.top,
        markerCentreY: markerRect.top + markerRect.height / 2,
        markerCentreX: markerRect.left + markerRect.width / 2,
      };
    }),
  );
}

function segmentsWithLine(segments: (RailSegment | null)[]): { current: RailSegment; next: RailSegment }[] {
  return segments.slice(0, -1).map((current, index) => {
    const next = segments[index + 1];

    if (!current || !next) throw new Error(`timeline item ${index} has no rail or marker`);

    return { current, next };
  });
}

async function expectRailThroughMarkerCentres(root: Locator): Promise<void> {
  const pairs = segmentsWithLine(await railGeometry(root));

  expect(pairs.length).toBeGreaterThan(0);

  for (const { current } of pairs) {
    expect(Math.abs(current.lineCentreX - current.markerCentreX)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(current.lineTop - current.markerCentreY)).toBeLessThanOrEqual(0.5);
  }
}

async function expectRailReachesNextMarker(root: Locator): Promise<void> {
  for (const { current, next } of segmentsWithLine(await railGeometry(root))) {
    expect(current.lineBottom).toBeGreaterThanOrEqual(next.markerTop - 0.5);
  }
}

test.describe('timeline / rail geometry', () => {
  test('the line leaves every marker from its centre, on the same axis, in every density', async ({ page }) => {
    await expectRailThroughMarkerCentres(await openStory(page, DEFAULT_STORY_ID));
    await expectRailThroughMarkerCentres(await openStory(page, WITH_MARKERS_STORY_ID));
    await expectRailThroughMarkerCentres(await openStory(page, COMPACT_STORY_ID));
  });

  test('with projected markers the line runs unbroken into the next marker', async ({ page }) => {
    await expectRailReachesNextMarker(await openStory(page, WITH_MARKERS_STORY_ID));
  });

  test('with the default dots the line runs unbroken into the next dot', async ({ page }) => {
    test.fail(true, 'the line stops at the next item top, leaving a gap above each inset dot');

    await expectRailReachesNextMarker(await openStory(page, DEFAULT_STORY_ID));
  });

  test('the compact dots keep the line unbroken too', async ({ page }) => {
    test.fail(true, 'the line stops at the next item top, leaving a gap above each inset dot');

    await expectRailReachesNextMarker(await openStory(page, COMPACT_STORY_ID));
  });
});

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
