import { Page, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, storyUrl, tabUntilFocused, tap } from '../support';

const ROUTING_STORY_ID = 'components-overlays-overlay-with-routing--default';
const OPENERS_STORY_ID = 'components-overlays-overlay-using-openers--default';

const PANE = '.et-overlay';
const ACTIVE_PAGE = '.et-overlay-router-outlet-page--active';
const LINK_NAME = 'Open via link';

async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator(PANE)).toHaveClass(/et-animation-enter-done/);
}

async function openRoutingOverlay(page: Page, trigger: string) {
  const root = await openStory(page, ROUTING_STORY_ID);

  await root.getByRole('button', { name: trigger }).click();
  await waitForEntered(page);
}

const overlayTitle = (page: Page) => page.locator(`${PANE} h2`);

test.describe('overlay routing / query-param link focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the link, which points at its query param, and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, OPENERS_STORY_ID);
    const link = root.getByRole('link', { name: LINK_NAME });

    await tabUntilFocused(page, link);

    await expectFocusVisible(link);
    await expect(link).toHaveAttribute('href', '#/?demo=from-link');
  });
});

test.describe('overlay routing / query-param link keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard interaction');

  test('Enter on the link opens the overlay with its value and moves focus into it', async ({ page }) => {
    const root = await openStory(page, OPENERS_STORY_ID);
    const link = root.getByRole('link', { name: LINK_NAME });

    await tabUntilFocused(page, link);
    await pressKey(page, 'Enter');
    await waitForEntered(page);

    await expect(page).toHaveURL(/#\/\?demo=from-link$/);
    await expect(page.locator(PANE)).toContainText('Current value: from-link');
    await expect(page.locator(PANE).getByRole('button', { name: 'Close' })).toBeFocused();
  });

  test('Escape closes the overlay, clears the query param and returns focus to the link', async ({ page }) => {
    const root = await openStory(page, OPENERS_STORY_ID);
    const link = root.getByRole('link', { name: LINK_NAME });

    await tabUntilFocused(page, link);
    await pressKey(page, 'Enter');
    await waitForEntered(page);

    await pressKey(page, 'Escape');

    await expect(page.locator(PANE)).toHaveCount(0);
    await expect(page).not.toHaveURL(/demo=/);
    await expect(link).toBeFocused();
  });
});

test.describe('overlay routing / query-param link pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse interaction');

  test('browser back closes an overlay the link opened, and forward opens it again', async ({ page }) => {
    const root = await openStory(page, OPENERS_STORY_ID);

    await root.getByRole('link', { name: LINK_NAME }).click();
    await waitForEntered(page);

    await page.goBack();
    await expect(page.locator(PANE)).toHaveCount(0);

    await page.goForward();
    await waitForEntered(page);
    await expect(page.locator(PANE)).toContainText('Current value: from-link');
  });

  test('a deep link with the query param opens the overlay on load', async ({ page }) => {
    await page.goto(`${storyUrl(OPENERS_STORY_ID)}#/?demo=deep-link`);
    await waitForEntered(page);

    await expect(page.locator(PANE)).toContainText('Current value: deep-link');
  });
});

test.describe('overlay routing / query-param link touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the link opens the overlay, and a tap on Close closes it and clears the param', async ({ page }) => {
    const root = await openStory(page, OPENERS_STORY_ID);

    await tap(root.getByRole('link', { name: LINK_NAME }));
    await waitForEntered(page);

    await expect(page.locator(PANE)).toContainText('Current value: from-link');

    await tap(page.locator(PANE).getByRole('button', { name: 'Close' }));

    await expect(page.locator(PANE)).toHaveCount(0);
    await expect(page).not.toHaveURL(/demo=/);
  });
});

test.describe('overlay routing / router keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard interaction');

  test('the active route link carries aria-current, and Enter on another link navigates to it', async ({ page }) => {
    await openRoutingOverlay(page, 'Multi-step routing');

    const details = page.getByRole('button', { name: 'Details' });
    const members = page.getByRole('button', { name: 'Members' });

    await expect(details).toBeFocused();
    await expect(details).toHaveAttribute('aria-current', 'page');

    await pressKey(page, 'Tab');
    await expect(members).toBeFocused();
    await pressKey(page, 'Enter');

    await expect(overlayTitle(page)).toHaveText('Invite members');
    await expect(members).toHaveAttribute('aria-current', 'page');
    await expect(details).not.toHaveAttribute('aria-current', 'page');
  });

  test('a navigation moves focus onto the new page', async ({ page }) => {
    await openRoutingOverlay(page, 'Multi-step routing');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect(overlayTitle(page)).toHaveText('Invite members');
    await expect(page.locator(`${ACTIVE_PAGE}:focus-within`)).toHaveCount(1);
  });
});

test.describe('overlay routing / router pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse interaction');

  test('a URL-synced route follows browser back, and the back control closes on the first route', async ({ page }) => {
    await openRoutingOverlay(page, 'URL-synced routing');

    await page.getByRole('button', { name: 'Members' }).click();
    await expect(overlayTitle(page)).toHaveText('Invite members');
    await expect(page).toHaveURL(/ovr-0=%2Fmembers/);

    await page.goBack();
    await expect(overlayTitle(page)).toHaveText('Create workspace');

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.locator(PANE)).toHaveCount(0);
    await expect(page).not.toHaveURL(/ovr-0=/);
  });

  test('a navigation back during the page transition still shows the route header', async ({ page }) => {
    await openRoutingOverlay(page, 'Multi-step routing');

    await page.getByRole('button', { name: 'Members' }).click();
    await page.getByRole('button', { name: 'Details' }).click();

    await expect(overlayTitle(page)).toHaveText('Create workspace');
  });

  test('a disabled outlet renders its placeholder until it is enabled again', async ({ page }) => {
    await openRoutingOverlay(page, 'Multi-step routing');

    await page.getByRole('button', { name: 'Disable outlet' }).click();
    await expect(overlayTitle(page)).toHaveText('Hang tight…');

    await page.getByRole('button', { name: 'Enable outlet' }).click();
    await expect(overlayTitle(page)).toHaveText('Create workspace');
  });
});

test.describe('overlay routing / router touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on a route link navigates and moves aria-current', async ({ page }) => {
    const root = await openStory(page, ROUTING_STORY_ID);

    await tap(root.getByRole('button', { name: 'Multi-step routing' }));
    await waitForEntered(page);

    const review = page.getByRole('button', { name: 'Review' });

    await tap(review);

    await expect(overlayTitle(page)).toHaveText('Review & create');
    await expect(review).toHaveAttribute('aria-current', 'page');
  });
});
