import { expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-navigation-pagination--default';
const MANY_PAGES_STORY_ID = 'components-navigation-pagination--many-pages';
const LINKS_STORY_ID = 'components-navigation-pagination--links';
const RANGE_AND_JUMP_STORY_ID = 'components-navigation-pagination--with-range-and-jump';
const PAGE_SIZE_SELECT_STORY_ID = 'components-navigation-pagination--page-size-select';

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
