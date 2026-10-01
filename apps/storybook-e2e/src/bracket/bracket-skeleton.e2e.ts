import { Page, expect, test } from '@playwright/test';
import { openStory } from '../support';

const DOUBLE_ELIMINATION_ID = 'components-sports-bracket-skeleton--double-elimination';
const CONTINUE_ID = 'components-sports-bracket-skeleton--double-elimination-continue';

const MATCH_CELL = '.et-bracket-element--match';
const CONTINUE_CELL = '.et-bracket-element--continue';

function readGrid(page: Page) {
  return page.locator('et-bracket').evaluate(
    (bracket, selectors) => {
      const origin = bracket.getBoundingClientRect();
      const rectOf = (el: Element) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.x - origin.x), Math.round(r.y - origin.y), Math.round(r.width), Math.round(r.height)];
      };
      const bone = bracket.querySelector('.et-bracket-skeleton-continue-bone');

      return {
        size: [Math.round(origin.width), Math.round(origin.height)],
        matches: Array.from(bracket.querySelectorAll(selectors.match)).map(rectOf).map(String).sort(),
        continueCells: Array.from(bracket.querySelectorAll(selectors.continue)).map(rectOf),
        bone: bone ? [bone.getBoundingClientRect().width, bone.getBoundingClientRect().height] : null,
      };
    },
    { match: MATCH_CELL, continue: CONTINUE_CELL },
  );
}

test.describe('bracket skeleton', () => {
  test('draws the loading grid of the loaded bracket', async ({ page }) => {
    await openStory(page, DOUBLE_ELIMINATION_ID);
    const skeleton = await readGrid(page);

    await openStory(page, DOUBLE_ELIMINATION_ID, { args: { loaded: true } });
    const loaded = await readGrid(page);

    expect(skeleton.matches.length).toBeGreaterThan(0);
    expect(skeleton.size).toEqual(loaded.size);
    expect(skeleton.matches).toEqual(loaded.matches);
  });

  test('draws a continue bone as big as the continue cell', async ({ page }) => {
    await openStory(page, CONTINUE_ID);
    const skeleton = await readGrid(page);

    await openStory(page, CONTINUE_ID, { args: { loaded: true } });
    const loaded = await readGrid(page);

    expect(skeleton.continueCells).toHaveLength(1);
    expect(skeleton.continueCells).toEqual(loaded.continueCells);
    expect(skeleton.size).toEqual(loaded.size);
    expect(skeleton.matches).toEqual(loaded.matches);

    const [, , width, height] = skeleton.continueCells[0] ?? [];

    expect(skeleton.bone).toEqual([width, height]);
  });
});
