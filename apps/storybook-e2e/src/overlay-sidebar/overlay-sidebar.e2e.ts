import { Locator, Page, expect, test } from '@playwright/test';
import { expectTouchMode, openStory, pressKey, tabUntilFocused, tap } from '../support';

const STORY_ID = 'components-overlays-overlay-with-routing--default';

const PANE = '.et-overlay';
const SIDEBAR = '.et-overlay-sidebar-host';
const ACTIVE_PAGE = '.et-overlay-router-outlet-page--active';

async function waitForEntered(page: Page): Promise<void> {
  await expect(page.locator(PANE)).toHaveClass(/et-animation-enter-done/);
}

async function openSidebarOverlay(page: Page) {
  const root = await openStory(page, STORY_ID);
  const trigger = root.getByRole('button', { name: 'Sidebar navigation' });

  await trigger.click();
  await waitForEntered(page);

  return trigger;
}

async function tapOpenSidebarOverlay(page: Page) {
  const root = await openStory(page, STORY_ID);

  await tap(root.getByRole('button', { name: 'Sidebar navigation' }));
  await waitForEntered(page);
}

const pageTitle = (page: Page) => page.locator(`${ACTIVE_PAGE} h3`);

/** A nav tab link keeps `outline: none` and paints its ring on the inner content span. */
async function expectNavTabFocusVisible(tab: Locator): Promise<void> {
  await expect(tab).toBeFocused();
  expect(await tab.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

  const outlineStyle = await tab
    .locator('.et-nav-tab-link__content')
    .evaluate((el) => getComputedStyle(el).outlineStyle);

  expect(outlineStyle).not.toBe('none');
}

test.describe('overlay sidebar / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a keyboard open renders the sidebar inline and puts a visible ring on the active tab', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const trigger = root.getByRole('button', { name: 'Sidebar navigation' });

    await tabUntilFocused(page, trigger);
    await pressKey(page, 'Enter');
    await waitForEntered(page);

    await expect(page.locator(SIDEBAR)).toHaveClass(/et-overlay-sidebar--visible/);

    const general = page.getByRole('tab', { name: 'General' });

    await expect(general).toHaveAttribute('aria-selected', 'true');
    await expectNavTabFocusVisible(general);
  });

  test('Tab moves from the sidebar into the page and wraps back to the tab list', async ({ page }) => {
    await openSidebarOverlay(page);

    const general = page.getByRole('tab', { name: 'General' });
    const close = page.locator(SIDEBAR).getByRole('button', { name: 'Close' });
    const nameInput = page.locator(`${ACTIVE_PAGE} input`);

    await expect(general).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(close).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(nameInput).toBeFocused();

    await pressKey(page, 'Tab');
    await expect(general).toBeFocused();
  });
});

test.describe('overlay sidebar / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('ArrowDown moves focus along the sidebar tabs without navigating', async ({ page }) => {
    await openSidebarOverlay(page);

    await pressKey(page, 'ArrowDown');

    await expect(page.getByRole('tab', { name: 'Notifications' })).toBeFocused();
    await expect(pageTitle(page)).toHaveText('General');
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  test('Enter on a sidebar tab navigates, moves the selection and focuses the new page', async ({ page }) => {
    await openSidebarOverlay(page);

    const notifications = page.getByRole('tab', { name: 'Notifications' });

    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');

    await expect(pageTitle(page)).toHaveText('Notifications');
    await expect(notifications).toHaveAttribute('aria-selected', 'true');
    await expect(notifications).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator(`${ACTIVE_PAGE}:focus-within`)).toHaveCount(1);
  });

  test('Escape closes the overlay and returns focus to the trigger', async ({ page }) => {
    const trigger = await openSidebarOverlay(page);

    await pressKey(page, 'Escape');

    await expect(page.locator(PANE)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('overlay sidebar / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse interaction');

  test('a click on a sidebar tab navigates to its page', async ({ page }) => {
    await openSidebarOverlay(page);

    await page.getByRole('tab', { name: 'About' }).click();

    await expect(pageTitle(page)).toHaveText('About');
    await expect(page.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the sidebar Close button closes the overlay and returns focus to the trigger', async ({ page }) => {
    const trigger = await openSidebarOverlay(page);

    await page.locator(SIDEBAR).getByRole('button', { name: 'Close' }).click();

    await expect(page.locator(PANE)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('an unsaved edit holds the selection on the current tab until the navigation is confirmed', async ({ page }) => {
    await openSidebarOverlay(page);

    const general = page.getByRole('tab', { name: 'General' });
    const notifications = page.getByRole('tab', { name: 'Notifications' });

    await page.locator(`${ACTIVE_PAGE} input`).fill('Renamed');
    await notifications.click();

    const confirm = page.getByRole('dialog', { name: 'Discard changes?' });

    await expect(confirm).toBeVisible();
    await expect(general).toHaveAttribute('aria-selected', 'true');

    await confirm.getByRole('button', { name: 'Keep editing' }).click();

    await expect(confirm).toHaveCount(0);
    await expect(pageTitle(page)).toHaveText('General');
    await expect(general).toHaveAttribute('aria-selected', 'true');

    await notifications.click();
    await page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard' }).click();

    await expect(pageTitle(page)).toHaveText('Notifications');
    await expect(notifications).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('overlay sidebar / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: collapsed sidebar on a narrow pane');

  test('on a narrow pane the sidebar collapses and the page offers a menu link instead', async ({ page }) => {
    await tapOpenSidebarOverlay(page);

    await expectTouchMode(page);
    await expect(page.locator(SIDEBAR)).not.toHaveClass(/et-overlay-sidebar--visible/);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '☰ Menu' })).toBeVisible();
  });

  test('a tap on the menu link opens the sidebar as a page, and a tap on a tab navigates from it', async ({ page }) => {
    await tapOpenSidebarOverlay(page);

    await tap(page.getByRole('button', { name: '☰ Menu' }));

    const activePage = page.locator(ACTIVE_PAGE);

    await expect(activePage.getByRole('tab')).toHaveCount(3);
    await expect(activePage.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');

    await tap(activePage.getByRole('tab', { name: 'Notifications' }));

    await expect(pageTitle(page)).toHaveText('Notifications');
    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('a tap on the Close button of the sidebar page closes the overlay', async ({ page }) => {
    await tapOpenSidebarOverlay(page);

    await tap(page.getByRole('button', { name: '☰ Menu' }));
    await tap(page.locator(ACTIVE_PAGE).getByRole('button', { name: 'Close' }));

    await expect(page.locator(PANE)).toHaveCount(0);
  });
});
