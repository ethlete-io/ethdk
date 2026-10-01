import { Locator, expect, test } from '@playwright/test';
import { openStory, settle } from '../support';

const STORY_ID = 'components-data-display-paged-query-trigger--default';

const TRACK = '.et-scrollable-container';
const TOTAL_ITEMS = { rail: 24, list: 20 };

const ROOT_MARGIN_PX = 200;
const RAIL_PAGE_WIDTH_PX = 6 * (180 + 12);

type Axis = 'horizontal' | 'vertical';

function distancePastTrack(root: Locator): Promise<number> {
  return root.evaluate((el) => {
    const track = el.querySelector('[data-testid="rail"] .et-scrollable-container');
    const trigger = el.querySelector('[data-testid="rail-trigger"]');

    return (trigger?.getBoundingClientRect().left ?? 0) - (track?.getBoundingClientRect().right ?? 0);
  });
}

function scrollTrackToEnd(track: Locator, axis: Axis, offset = 0): Promise<void> {
  return track.evaluate(
    (el, { axis, offset }) => {
      if (axis === 'horizontal') el.scrollLeft = el.scrollWidth - el.clientWidth - offset;
      else el.scrollTop = el.scrollHeight - el.clientHeight - offset;
    },
    { axis, offset },
  );
}

async function expectSettledCount(trigger: Locator, items: Locator): Promise<number> {
  await expect(trigger).not.toHaveAttribute('data-loading');
  await settle(trigger.page(), 400);
  await expect(trigger).not.toHaveAttribute('data-loading');

  return items.count();
}

async function expectScrollingLoadsEverything(root: Locator, name: 'rail' | 'list', axis: Axis): Promise<void> {
  const track = root.getByTestId(name).locator(TRACK);
  const trigger = root.getByTestId(`${name}-trigger`);
  const items = root.getByTestId(`${name}-item`);

  await expect(async () => {
    await scrollTrackToEnd(track, axis);
    await expect(trigger).toHaveAttribute('data-exhausted', '', { timeout: 500 });
  }).toPass({ timeout: 10_000 });

  await expect(items).toHaveCount(TOTAL_ITEMS[name]);
  await expect(root.getByTestId(`${name}-status`)).toContainText('all loaded');
}

test.describe('paged query trigger / scrolling', () => {
  test('fills the rail on load until its end is past the root margin, and no further', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { delay: 100 } });

    await expectSettledCount(root.getByTestId('rail-trigger'), root.getByTestId('rail-item'));

    const distance = await distancePastTrack(root);

    expect(distance).toBeGreaterThan(ROOT_MARGIN_PX);
    expect(distance).toBeLessThan(ROOT_MARGIN_PX + RAIL_PAGE_WIDTH_PX);
  });

  test('loads the next page when the rail end scrolls into view', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { delay: 100 } });
    const trigger = root.getByTestId('rail-trigger');
    const items = root.getByTestId('rail-item');
    const before = await expectSettledCount(trigger, items);

    await scrollTrackToEnd(root.getByTestId('rail').locator(TRACK), 'horizontal');

    await expect.poll(() => items.count()).toBeGreaterThan(before);
  });

  test('pre-fetches inside the rail by the root margin', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { delay: 100, rootMargin: '400px' } });
    const trigger = root.getByTestId('rail-trigger');
    const items = root.getByTestId('rail-item');
    const before = await expectSettledCount(trigger, items);

    await scrollTrackToEnd(root.getByTestId('rail').locator(TRACK), 'horizontal', 300);

    await expect.poll(() => items.count()).toBeGreaterThan(before);
  });

  test('does not fetch while the rail end is outside the root margin', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { delay: 100, rootMargin: '0px' } });
    const trigger = root.getByTestId('rail-trigger');
    const items = root.getByTestId('rail-item');
    const before = await expectSettledCount(trigger, items);

    await scrollTrackToEnd(root.getByTestId('rail').locator(TRACK), 'horizontal', 300);
    await settle(page, 400);

    await expect(items).toHaveCount(before);
  });

  test('keeps loading the rail until the stack is exhausted', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { delay: 100 } });

    await expectScrollingLoadsEverything(root, 'rail', 'horizontal');
  });

  test('keeps loading the vertical list until the stack is exhausted', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { delay: 100 } });

    await expectScrollingLoadsEverything(root, 'list', 'vertical');
  });
});
