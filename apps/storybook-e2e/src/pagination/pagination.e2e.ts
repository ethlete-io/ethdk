import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, expectTouchMode, openStory, pressKey, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-navigation-pagination--default';
const MANY_PAGES_STORY_ID = 'components-navigation-pagination--many-pages';
const LINKS_STORY_ID = 'components-navigation-pagination--links';
const RANGE_AND_JUMP_STORY_ID = 'components-navigation-pagination--with-range-and-jump';
const PAGE_SIZE_SELECT_STORY_ID = 'components-navigation-pagination--page-size-select';
const FOOTER_ROW_STORY_ID = 'components-navigation-pagination--footer-row';

const TOUCH_TARGET = 44;

interface TargetGeometry {
  isButton: boolean;
  width: number;
  height: number;
  hitWidth: number;
  hitHeight: number;
  gapAfter: number | null;
}

async function targetGeometry(root: Locator): Promise<TargetGeometry[]> {
  return root.locator('.et-pagination-list > li').evaluateAll((items) =>
    items.map((item, index) => {
      const button = item.querySelector('.et-pagination-button');
      const box = button ?? item;
      const rect = box.getBoundingClientRect();
      const hit = getComputedStyle(box, '::before');
      const next = items[index + 1];

      return {
        isButton: button !== null,
        width: rect.width,
        height: rect.height,
        hitWidth: parseFloat(hit.width),
        hitHeight: parseFloat(hit.height),
        gapAfter: next ? next.getBoundingClientRect().left - item.getBoundingClientRect().right : null,
      };
    }),
  );
}

/**
 * No point of a visible pagination box resolves to another target, and the band the hit area adds
 * above and below a button resolves to the button - so an enlarged target never steals a tap that lands
 * on its neighbour.
 */
async function expectTapsLandOnTheirOwnTarget(root: Locator): Promise<void> {
  const misses = await root
    .locator('.et-pagination-button, .et-pagination-status, .et-pagination-ellipsis')
    .evaluateAll((elements, target) => {
      const found: string[] = [];
      const ownerOf = (x: number, y: number) =>
        document
          .elementFromPoint(x, y)
          ?.closest('.et-pagination-button, .et-pagination-status, .et-pagination-ellipsis');

      for (const element of elements) {
        const rect = element.getBoundingClientRect();

        for (let x = rect.left + 0.5; x < rect.right; x += 1) {
          for (let y = rect.top + 0.5; y < rect.bottom; y += 1) {
            const owner = ownerOf(x, y);

            if (owner && owner !== element) found.push(`${owner.getAttribute('aria-label')} over ${x},${y}`);
          }
        }

        if (!element.matches('.et-pagination-button:not(:disabled)')) continue;

        const band = (target - rect.height) / 2;
        const centerX = rect.left + rect.width / 2;

        for (const y of [rect.top - band + 0.5, rect.bottom + band - 0.5]) {
          if (ownerOf(centerX, y) !== element) found.push(`hit band of ${element.getAttribute('aria-label')} at ${y}`);
        }
      }

      return found;
    }, TOUCH_TARGET);

  expect(misses).toEqual([]);
}

test.describe('pagination / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab skips the disabled first/previous controls and lands on page 1 with a visible focus ring', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const firstPage = root.getByRole('button', { name: 'Page 1', exact: true });

    await pressKey(page, 'Tab');

    await expectFocusVisible(firstPage);
  });

  test('previous and first are disabled on the first page', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.getByRole('button', { name: 'First page' })).toBeDisabled();
    await expect(root.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });
});

test.describe('pagination / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('Tab visits every enabled control in order, skipping the ellipsis', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const descriptors = await tabSequence(page, 8);

    expect(descriptors.map((descriptor) => descriptor.name)).toEqual([
      'Page 1',
      'Page 2',
      'Page 3',
      'Page 4',
      'Page 5',
      'Page 10',
      'Next page',
      'Last page',
    ]);
  });

  for (const key of ['Enter', 'Space']) {
    test(`${key} activates the focused page button and moves aria-current`, async ({ page }) => {
      const root = await openStory(page, DEFAULT_STORY_ID);
      const pageOne = root.getByRole('button', { name: 'Page 1', exact: true });
      const pageTwo = root.getByRole('button', { name: 'Page 2', exact: true });

      await pressKey(page, 'Tab');
      await pressKey(page, 'Tab');
      await expect(pageTwo).toBeFocused();

      await pressKey(page, key);

      await expect(pageTwo).toHaveAttribute('aria-current', 'page');
      await expect(pageOne).not.toHaveAttribute('aria-current', 'page');
    });
  }

  test('the ellipsis is inert and is not part of the tab order', async ({ page }) => {
    const root = await openStory(page, MANY_PAGES_STORY_ID);
    const ellipsis = root.locator('.et-pagination-ellipsis');

    await expect(ellipsis).toHaveAttribute('aria-hidden', 'true');

    await tabSequence(page, 5);
    await expect(root.getByRole('button', { name: 'Page 5', exact: true })).toBeFocused();

    await pressKey(page, 'Tab');

    await expect(root.getByRole('button', { name: 'Page 200', exact: true })).toBeFocused();
  });

  test('the jump-to-page field accepts a page number and Enter navigates to it', async ({ page }) => {
    const root = await openStory(page, RANGE_AND_JUMP_STORY_ID);
    const jumpInput = root.getByLabel('Go to page');
    const readout = root.locator('.et-pagination-readout-text');

    await expect(readout).toHaveText('Showing 1–20 of 500');

    await jumpInput.fill('5');
    await jumpInput.press('Enter');

    await expect(root.getByRole('button', { name: 'Page 5', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(readout).toHaveText('Showing 81–100 of 500');
    await expect(jumpInput).toHaveValue('');
  });

  test('the range readout matches the current page, including the compact pager', async ({ page }) => {
    const root = await openStory(page, PAGE_SIZE_SELECT_STORY_ID);
    const readout = root.locator('.et-pagination-readout-text');

    await expect(readout).toHaveText('1–25 of 137');

    await root.getByRole('button', { name: 'Next page' }).click();

    await expect(readout).toHaveText('26–50 of 137');
  });

  test('the links variant renders page items as anchors, and a plain click is intercepted (no full navigation)', async ({
    page,
  }) => {
    const root = await openStory(page, LINKS_STORY_ID);
    const secondPageLink = root.getByRole('link', { name: 'Page 2', exact: true });

    await expect(secondPageLink).toHaveAttribute('href', '?page=2');

    const urlBefore = page.url();
    await secondPageLink.click();

    await expect(secondPageLink).toHaveAttribute('aria-current', 'page');
    expect(page.url()).toBe(urlBefore);
  });
});

test.describe('pagination / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap changes the page', async ({ page }) => {
    // The touch viewport is under the compact threshold, so the pager has no page-number buttons.
    const root = await openStory(page, DEFAULT_STORY_ID);
    const readout = root.locator('.et-pagination-readout-text');

    await expect(readout).toHaveText('1 / 10');

    await tap(root.getByRole('button', { name: 'Next page' }));

    await expect(readout).toHaveText('2 / 10');
  });
});

test.describe('pagination / touch hit area', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: coarse pointer hit area');

  test('the compact pager keeps its 34px chevrons and 2px gap but takes a 44px tap', async ({ page }) => {
    const root = await openStory(page, PAGE_SIZE_SELECT_STORY_ID);
    await expectTouchMode(page);

    const [status, previous, next] = await targetGeometry(root);

    expect(status?.gapAfter).toBe(2);
    expect(previous).toEqual({
      isButton: true,
      width: 34,
      height: 34,
      hitWidth: TOUCH_TARGET,
      hitHeight: TOUCH_TARGET,
      gapAfter: 2,
    });
    expect(next).toEqual({
      isButton: true,
      width: 34,
      height: 34,
      hitWidth: TOUCH_TARGET,
      hitHeight: TOUCH_TARGET,
      gapAfter: null,
    });
    await expectTapsLandOnTheirOwnTarget(root);
  });

  test('size="sm" keeps its 28px items and 4px gap but takes a 44px tap', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { size: 'sm' } });
    await expectTouchMode(page);

    const geometry = await targetGeometry(root);
    const buttons = geometry.filter((item) => item.isButton);

    expect(buttons.length).toBeGreaterThan(3);
    expect(new Set(buttons.map((item) => `${item.width}x${item.height}`))).toEqual(new Set(['28x28']));
    expect(new Set(buttons.map((item) => `${item.hitWidth}x${item.hitHeight}`))).toEqual(new Set(['44x44']));
    expect(new Set(geometry.slice(0, -1).map((item) => item.gapAfter))).toEqual(new Set([4]));
    await expectTapsLandOnTheirOwnTarget(root);
  });
});

test.describe('pagination / responsive', () => {
  test('in a flex row the page window trims as the row narrows and comes back when it widens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const root = await openStory(page, FOOTER_ROW_STORY_ID);
    const items = root.locator('.et-pagination-list > li');
    const wideCount = await items.count();

    await page.setViewportSize({ width: 480, height: 800 });
    await expect.poll(() => items.count()).toBeLessThan(wideCount);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => items.count()).toBe(wideCount);
  });
});
