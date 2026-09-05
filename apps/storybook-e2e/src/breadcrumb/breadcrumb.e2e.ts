import { Locator, expect, test } from '@playwright/test';
import {
  expectFocusVisible,
  expectTouchMode,
  focusedDescriptor,
  openStory,
  pressKey,
  tabSequence,
  tap,
} from '../support';

const DEFAULT_STORY_ID = 'components-navigation-breadcrumb--default';
const COLLAPSED_STORY_ID = 'components-navigation-breadcrumb--collapsed';
const LOADING_STORY_ID = 'components-navigation-breadcrumb--loading';
const CUSTOM_SEPARATOR_STORY_ID = 'components-navigation-breadcrumb--custom-separator';
const ROUTED_OUTLET_STORY_ID = 'components-navigation-breadcrumb--routed-outlet';

const OVERFLOW_LABEL = 'Show hidden levels';

/** The landmark itself - `role="navigation"` on `<et-breadcrumb>`, labelled by the `navigation` label. */
function breadcrumb(root: Locator): Locator {
  return root.getByRole('navigation', { name: 'Breadcrumb' });
}

/** The routed story's own demo nav, which is a real `<nav>` element and so never the breadcrumb. */
function demoNav(root: Locator): Locator {
  return root.locator('nav');
}

function crumbs(root: Locator): Locator {
  return breadcrumb(root).locator('.et-breadcrumb-item');
}

/** The overlay arms its outside-pointer close only after the enter transition. Wait before you click outside. */
async function waitForPanelEntered(dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await dialog
    .locator('.et-toggletip-panel')
    .evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))),
    );
}

async function expectTrail(root: Locator, expected: string[]): Promise<void> {
  await expect(crumbs(root)).toHaveText(expected);
}

test.describe('breadcrumb / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the first crumb link and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.getByRole('link', { name: 'Home' }));
  });

  test('every linked crumb takes a visible focus ring', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    for (const name of ['Home', 'Competitions', 'Regionalliga Nordost', 'Matchday 14']) {
      await pressKey(page, 'Tab');
      await expectFocusVisible(root.getByRole('link', { name }));
    }
  });

  test('the current page is plain text, not a link, and is not focusable', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const current = breadcrumb(root).locator('[aria-current="page"]');

    await expect(current).toHaveText('Chemie Leipzig vs. Lok');
    await expect(current).toHaveJSProperty('tagName', 'SPAN');
    await expect(breadcrumb(root).getByRole('link', { name: 'Chemie Leipzig vs. Lok' })).toHaveCount(0);
    await expect(current).toHaveJSProperty('tabIndex', -1);
  });

  test('the overflow trigger takes a visible focus ring', async ({ page }) => {
    const root = await openStory(page, COLLAPSED_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFocusVisible(root.getByRole('button', { name: OVERFLOW_LABEL }));
  });

  test('an outside click closes the overflow and returns focus to its trigger', async ({ page }) => {
    const root = await openStory(page, COLLAPSED_STORY_ID);
    const trigger = root.getByRole('button', { name: OVERFLOW_LABEL });
    const dialog = page.getByRole('dialog');

    await trigger.click();
    await waitForPanelEntered(dialog);

    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('breadcrumb / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation and the desktop trail width');

  test('the host is the navigation landmark, wrapping an ordered list of crumbs', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const nav = breadcrumb(root);

    await expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    await expect(nav.locator('> ol')).toHaveCount(1);
    await expect(nav.getByRole('list')).toHaveCount(1);
    await expect(nav.getByRole('listitem')).toHaveCount(5);
  });

  test('only the last crumb carries aria-current="page"', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const nav = breadcrumb(root);

    await expectTrail(root, ['Home', 'Competitions', 'Regionalliga Nordost', 'Matchday 14', 'Chemie Leipzig vs. Lok']);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(crumbs(root).last()).toHaveAttribute('aria-current', 'page');
  });

  test('Tab visits the linked crumbs in trail order and stops at the current page', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const descriptors = await tabSequence(page, 5);

    expect(descriptors.slice(0, 4).map((descriptor) => descriptor.text)).toEqual([
      'Home',
      'Competitions',
      'Regionalliga Nordost',
      'Matchday 14',
    ]);
    expect(descriptors[4]?.tag).toBe('BODY');
  });

  test('separators are aria-hidden, live inside the preceding crumb and are not list items', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const nav = breadcrumb(root);
    const separators = nav.locator('.et-breadcrumb-separator');

    await expect(separators).toHaveCount(4);
    await expect(nav.locator('li > .et-breadcrumb-separator')).toHaveCount(4);

    for (const attribute of await separators.evaluateAll((els) => els.map((el) => el.getAttribute('aria-hidden')))) {
      expect(attribute).toBe('true');
    }

    await expect(nav.locator('li:last-child .et-breadcrumb-separator')).toHaveCount(0);
    await expect(nav.getByRole('listitem')).toHaveCount(4 + 1);
  });

  test('etBreadcrumbSeparator replaces the chevron and stays aria-hidden', async ({ page }) => {
    const root = await openStory(page, CUSTOM_SEPARATOR_STORY_ID);
    const nav = breadcrumb(root);
    const separators = nav.locator('.et-breadcrumb-separator');

    await expect(nav.locator('.et-breadcrumb-chevron')).toHaveCount(0);
    await expect(separators).toHaveText(['/', '/', '/', '/']);
    await expect(separators.first()).toHaveAttribute('aria-hidden', 'true');

    const descriptors = await tabSequence(page, 4);
    expect(descriptors.map((descriptor) => descriptor.text)).toEqual([
      'Home',
      'Competitions',
      'Regionalliga Nordost',
      'Matchday 14',
    ]);
  });

  test('a loading crumb holds its slot and announces the wait via role="status"', async ({ page }) => {
    const root = await openStory(page, LOADING_STORY_ID);
    const nav = breadcrumb(root);
    const skeleton = nav.locator('et-skeleton[role="status"]');

    await expect(nav.getByRole('listitem')).toHaveCount(5);
    await expect(skeleton).toHaveCount(1);
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    await expect(nav.locator('li:last-child et-skeleton')).toHaveCount(1);

    const width = await skeleton.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(0);
  });

  test('a collapsed trail keeps the first crumb and the current page, and hides the middle behind the trigger', async ({
    page,
  }) => {
    const root = await openStory(page, COLLAPSED_STORY_ID);
    const nav = breadcrumb(root);

    await expect(nav).toHaveAttribute('data-collapsed', '');
    await expect(nav.getByRole('listitem')).toHaveCount(3);
    await expectTrail(root, ['Home', 'Chemie Leipzig vs. Lok']);

    const trigger = root.getByRole('button', { name: OVERFLOW_LABEL });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  test('Tab reaches the overflow trigger between the first crumb and the current page', async ({ page }) => {
    await openStory(page, COLLAPSED_STORY_ID);

    const descriptors = await tabSequence(page, 3);

    expect(descriptors[0]?.text).toBe('Home');
    expect(descriptors[1]?.name).toBe(OVERFLOW_LABEL);
    expect(descriptors[2]?.tag).toBe('BODY');
  });

  for (const key of ['Enter', ' ']) {
    test(`${key === ' ' ? 'Space' : key} on the trigger opens the hidden crumbs and moves focus into them`, async ({
      page,
    }) => {
      const root = await openStory(page, COLLAPSED_STORY_ID);
      const trigger = root.getByRole('button', { name: OVERFLOW_LABEL });

      await pressKey(page, 'Tab');
      await pressKey(page, 'Tab');
      await expect(trigger).toBeFocused();

      await pressKey(page, key);

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(trigger).toHaveAttribute('aria-controls', /.+/);
      await expect(dialog.getByRole('link', { name: 'Competitions' })).toBeFocused();
    });
  }

  test('the hidden crumbs are a plain list of links in trail order, not a menu', async ({ page }) => {
    const root = await openStory(page, COLLAPSED_STORY_ID);

    await root.getByRole('button', { name: OVERFLOW_LABEL }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('menu')).toHaveCount(0);
    await expect(dialog.getByRole('menuitem')).toHaveCount(0);
    await expect(dialog.locator('ol > li')).toHaveCount(3);
    await expect(dialog.getByRole('link')).toHaveText(['Competitions', 'Regionalliga Nordost', 'Matchday 14']);
  });

  test('Tab walks the hidden crumbs once the overflow is open', async ({ page }) => {
    await openStory(page, COLLAPSED_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Competitions' })).toBeFocused();

    const descriptors = await tabSequence(page, 2);

    expect(descriptors.map((descriptor) => descriptor.text)).toEqual(['Regionalliga Nordost', 'Matchday 14']);
  });

  test('Escape closes the overflow and restores focus to the trigger', async ({ page }) => {
    const root = await openStory(page, COLLAPSED_STORY_ID);
    const trigger = root.getByRole('button', { name: OVERFLOW_LABEL });

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Competitions' })).toBeFocused();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('a composed trail appends one crumb per level and moves aria-current to the leaf', async ({ page }) => {
    const root = await openStory(page, ROUTED_OUTLET_STORY_ID);

    await expectTrail(root, ['Home']);

    await demoNav(root).getByRole('link', { name: 'Squad' }).click();

    await expect(crumbs(root)).toHaveText(['Home', 'Teams', 'BSG Chemie Leipzig', 'Squad']);
    await expect(crumbs(root).last()).toHaveAttribute('aria-current', 'page');
    await expect(breadcrumb(root).locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('leaving a level drops only the crumb that level owns', async ({ page }) => {
    const root = await openStory(page, ROUTED_OUTLET_STORY_ID);

    await demoNav(root).getByRole('link', { name: 'Squad' }).click();
    await expect(crumbs(root)).toHaveText(['Home', 'Teams', 'BSG Chemie Leipzig', 'Squad']);

    await demoNav(root).getByRole('link', { name: 'Team', exact: true }).click();

    await expect(crumbs(root)).toHaveText(['Home', 'Teams', 'BSG Chemie Leipzig']);
    await expect(crumbs(root).last()).toHaveAttribute('aria-current', 'page');
  });

  test('following a crumb navigates to that level and shortens the trail', async ({ page }) => {
    const root = await openStory(page, ROUTED_OUTLET_STORY_ID);

    await demoNav(root).getByRole('link', { name: 'Squad' }).click();
    await expect(crumbs(root)).toHaveText(['Home', 'Teams', 'BSG Chemie Leipzig', 'Squad']);

    await crumbs(root).nth(1).click();

    await expect(page).toHaveURL(/#\/teams$/);
    await expect(crumbs(root)).toHaveText(['Home', 'Teams']);
  });

  test('Enter on a focused crumb follows it', async ({ page }) => {
    const root = await openStory(page, ROUTED_OUTLET_STORY_ID);

    await demoNav(root).getByRole('link', { name: 'Teams' }).click();
    await expect(crumbs(root)).toHaveText(['Home', 'Teams']);

    await crumbs(root).first().focus();
    expect((await focusedDescriptor(page)).text).toBe('Home');

    await pressKey(page, 'Enter');

    await expect(page).toHaveURL(/#\/$/);
    await expectTrail(root, ['Home']);
  });
});

test.describe('breadcrumb / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a phone-width trail collapses behind the overflow trigger', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
    await expect(breadcrumb(root)).toHaveAttribute('data-collapsed', '');
    await expectTrail(root, ['Home', 'Chemie Leipzig vs. Lok']);
    await expect(root.getByRole('button', { name: OVERFLOW_LABEL })).toBeVisible();
  });

  test('a tap on the overflow trigger opens the hidden crumbs', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: OVERFLOW_LABEL });

    await tap(trigger);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByRole('link')).toHaveText(['Competitions', 'Regionalliga Nordost', 'Matchday 14']);
  });

  test('a tap outside closes the overflow again', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('button', { name: OVERFLOW_LABEL });
    const dialog = page.getByRole('dialog');

    await tap(trigger);
    await waitForPanelEntered(dialog);

    await page.locator('body').tap({ position: { x: 5, y: 5 } });

    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('a tap follows a crumb', async ({ page }) => {
    const root = await openStory(page, ROUTED_OUTLET_STORY_ID);

    await tap(demoNav(root).getByRole('link', { name: 'Teams' }));
    await expect(crumbs(root)).toHaveText(['Home', 'Teams']);

    await tap(crumbs(root).first());

    await expect(page).toHaveURL(/#\/$/);
    await expectTrail(root, ['Home']);
  });
});
