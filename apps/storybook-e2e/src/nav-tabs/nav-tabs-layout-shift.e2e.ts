import { Locator, expect, test } from '@playwright/test';
import { openStory, settle } from '../support';

const STORY_ID = 'components-navigation-tabs-nav-tabs--layout-shift';
const SHIFTS = ['font-swap', 'late-icon', 'hidden-first-frame'] as const;

interface CenterState {
  overflows: boolean;
  scrollLeft: number;
  expected: number;
}

async function centerState(root: Locator): Promise<CenterState | null> {
  return root.evaluate((el) => {
    const container = el.querySelector<HTMLElement>('.et-nav-tabs__container');
    const active = el.querySelector<HTMLElement>('a[aria-selected="true"]');

    if (!container || !active) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const activeCenter = activeRect.left - containerRect.left + container.scrollLeft + activeRect.width / 2;
    const max = container.scrollWidth - container.clientWidth;

    return {
      overflows: max > 0,
      scrollLeft: Math.round(container.scrollLeft),
      expected: Math.round(Math.min(max, Math.max(0, activeCenter - container.clientWidth / 2))),
    };
  });
}

async function waitForShift(root: Locator) {
  await expect(root.locator('[data-shifted]')).toHaveCount(1);
}

test.describe('nav-tabs / layout shift', () => {
  for (const shift of SHIFTS) {
    test(`keeps the active link centered after a ${shift}`, async ({ page }) => {
      const root = await openStory(page, STORY_ID, { args: { shift, shiftDelay: 400 } });

      await waitForShift(root);

      expect((await centerState(root))?.overflows).toBe(true);
      await expect
        .poll(async () => {
          const state = await centerState(root);

          return state ? Math.abs(state.scrollLeft - state.expected) : null;
        })
        .toBeLessThanOrEqual(2);
    });
  }

  test('a user scroll before the shift keeps its offset', async ({ page }) => {
    const root = await openStory(page, STORY_ID, { args: { shift: 'font-swap', shiftDelay: 1200 } });
    const container = root.locator('.et-nav-tabs__container');

    await expect.poll(async () => (await centerState(root))?.scrollLeft ?? 0).toBeGreaterThan(0);

    await container.dispatchEvent('wheel');
    await container.evaluate((el) => {
      el.scrollLeft = 0;
    });

    await waitForShift(root);
    await settle(page, 200);

    expect((await centerState(root))?.scrollLeft).toBe(0);
  });
});
