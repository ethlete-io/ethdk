import { Page, expect, test } from '@playwright/test';
import { openStory, settle } from '../support';

const DEFAULT_STORY_ID = 'components-dev-tools-query-devtools--default';
const LAZY_STORY_ID = 'components-dev-tools-query-devtools--lazy';

const PANEL = '.et-query-devtools-panel';
const TOGGLE_BUTTON = 'et-query-devtools-toggle button';
const ACTIVE_TAB = '.et-query-devtools-tab--active';

async function pressShortcut(page: Page) {
  await page.keyboard.press('Control+Alt+KeyQ');
}

function appButton(page: Page) {
  return page.getByRole('button', { name: 'Download', exact: true });
}

async function countClicksOnAppButton(page: Page) {
  await appButton(page).evaluate((button) => {
    button.setAttribute('data-e2e-clicks', '0');
    button.addEventListener('click', () =>
      button.setAttribute('data-e2e-clicks', String(Number(button.getAttribute('data-e2e-clicks')) + 1)),
    );
  });
}

test.describe('query devtools / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard shortcut');

  test('the shortcut opens the panel with focus on the active tab and closes it with focus restored', async ({
    page,
  }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const trigger = appButton(page);
    await trigger.focus();

    await pressShortcut(page);
    await expect(page.locator(PANEL)).toBeVisible();
    await expect(page.locator(ACTIVE_TAB)).toBeFocused();

    await pressShortcut(page);
    await expect(page.locator(PANEL)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('closing from the panel without a previous focus lands on the floating toggle', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await page.locator(TOGGLE_BUTTON).click();
    await expect(page.locator(ACTIVE_TAB)).toBeFocused();

    await page.locator(PANEL).getByRole('button', { name: /Close/ }).press('Enter');
    await expect(page.locator(PANEL)).toHaveCount(0);
    await expect(page.locator(TOGGLE_BUTTON)).toBeFocused();
  });

  test('closing the panel turns Inspect off, so app clicks reach the app', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);
    await countClicksOnAppButton(page);

    await pressShortcut(page);
    await page.locator('.et-query-devtools-inspect-btn').click();
    await expect(page.locator('.et-query-devtools-inspect-btn')).toHaveAttribute('aria-pressed', 'true');

    await pressShortcut(page);
    await expect(page.locator(PANEL)).toHaveCount(0);

    await appButton(page).click();
    await settle(page, 100);

    await expect(appButton(page)).toHaveAttribute('data-e2e-clicks', '1');
    await expect(page.locator('.et-query-devtools-inspect-box')).toHaveCount(0);
  });

  test('the lazy shell loads the panel on the first shortcut and focuses it', async ({ page }) => {
    await openStory(page, LAZY_STORY_ID);
    await expect(page.locator(TOGGLE_BUTTON)).toBeVisible();
    await expect(page.locator(PANEL)).toHaveCount(0);

    await pressShortcut(page);
    await expect(page.locator(PANEL)).toBeVisible();
    await expect(page.locator(ACTIVE_TAB)).toBeFocused();

    await pressShortcut(page);
    await expect(page.locator(PANEL)).toHaveCount(0);
  });
});

const AUTOMATION_STORY_ID = 'components-dev-tools-query-devtools--automation';
const PILL_HOST = '#et-query-devtools-pill';
const TOGGLE = 'et-query-devtools-toggle';

async function expectDevtoolsHidden(page: Page) {
  for (const selector of [PILL_HOST, TOGGLE, TOGGLE_BUTTON, PANEL]) {
    for (const element of await page.locator(selector).all()) {
      await expect(element).toBeHidden();
    }
  }
}

async function expectNoDevtoolsOverlap(page: Page) {
  const button = await appButton(page).boundingBox();
  expect(button).not.toBeNull();
  const hits = await page.evaluate((box) => {
    const overlaps = (r: DOMRect) =>
      !!box &&
      r.width > 0 &&
      r.height > 0 &&
      r.left < box.x + box.width &&
      r.right > box.x &&
      r.top < box.y + box.height &&
      r.bottom > box.y;
    return Array.from(
      document.querySelectorAll('#et-query-devtools-pill, et-query-devtools-toggle, .et-query-devtools-panel'),
    )
      .filter((el) => overlaps(el.getBoundingClientRect()))
      .map((el) => el.tagName);
  }, button);
  expect(hits).toEqual([]);
}

test.describe('query devtools / automation', () => {
  test('the UI hides itself under automation and never covers an app button', async ({ page }) => {
    await openStory(page, AUTOMATION_STORY_ID);
    await settle(page, 300);
    await countClicksOnAppButton(page);

    await expectDevtoolsHidden(page);
    await expectNoDevtoolsOverlap(page);

    await appButton(page).click();
    await settle(page, 100);
    await expect(appButton(page)).toHaveAttribute('data-e2e-clicks', '1');
  });

  test('the shortcut does not show the panel under automation', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut');
    await openStory(page, AUTOMATION_STORY_ID);
    await settle(page, 300);

    await pressShortcut(page);
    await settle(page, 200);

    await expectDevtoolsHidden(page);
    await expectNoDevtoolsOverlap(page);
  });

  test('showInAutomation keeps the toggle visible', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expect(page.locator(TOGGLE_BUTTON)).toBeVisible();
  });
});
