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
});
