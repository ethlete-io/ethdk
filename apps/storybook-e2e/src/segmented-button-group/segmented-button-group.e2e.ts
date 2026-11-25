import { expect, test } from '@playwright/test';
import { boxOf, openStory } from '../support';

const IN_SCROLLABLE_STORY_ID = 'components-forms-selection-list-segmented-button-group--in-scrollable';

test.describe('segmented button group', () => {
  test('keeps its content width as a direct child of an auto-sized scrollable', async ({ page }) => {
    const root = await openStory(page, IN_SCROLLABLE_STORY_ID);
    const group = root.locator(
      'et-scrollable > .et-scrollable-wrapper > .et-scrollable-container > et-segmented-button-group',
    );
    const label = group.locator('.et-segmented-button-label');

    await expect(label).toHaveText('EA SPORTS FC');

    const labelBox = await boxOf(label);
    expect(labelBox.width).toBeGreaterThan(50);
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect((await boxOf(group)).width).toBeGreaterThanOrEqual(labelBox.width);
  });

  test('tabs variant consumes the et-tab tokens set on a host', async ({ page }) => {
    const root = await openStory(
      page,
      'components-forms-selection-list-segmented-button-group--tabs-restyled-with-tokens',
    );
    const segment = root.locator('et-segmented-button-group[data-variant="tabs"] et-segmented-button').first();

    const style = await segment.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.textTransform, spacing: cs.letterSpacing, weight: cs.fontWeight };
    });

    expect(style.transform).toBe('uppercase');
    expect(style.spacing).not.toBe('normal');
    expect(style.weight).toBe('700');
  });
});
