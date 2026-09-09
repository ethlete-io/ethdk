import { expect, test } from '@playwright/test';
import { countClicks, expectFocusVisible, expectTouchMode, openStory, pressKey, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-feedback-empty-state--default';
const WITHOUT_ACTION_STORY_ID = 'components-feedback-empty-state--without-action';
const ERRORED_STORY_ID = 'components-feedback-empty-state--errored';

const EMPTY_STATE = '.et-empty-state';
const TITLE = '.et-empty-state-title';
const DESCRIPTION = '.et-empty-state-description';
const ICON = '.et-empty-state > .et-icon';
const ACTION = '[etEmptyStateAction]';

test.describe('empty-state / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the projected action with a visible focus ring', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(ACTION));
  });

  test('the projected action is the only tab stop in the empty state', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, 2);

    expect(sequence[0]?.text).toBe('Clear filters');
    expect(sequence[1]?.tag).toBe('BODY');
  });

  test('an empty state without an action has no tab stop of its own', async ({ page }) => {
    const root = await openStory(page, WITHOUT_ACTION_STORY_ID);

    await expect(root.locator(ACTION)).toHaveCount(0);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('the projected icon is not focusable', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(ICON)).toHaveCount(1);
    await expect(root.locator(ICON)).not.toHaveAttribute('tabindex', /.*/);
  });

  test('the empty state renders icon, title, description and action in that order', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const order = await root.locator(EMPTY_STATE).evaluate((el) =>
      Array.from(el.children).map((child) => {
        if (child.classList.contains('et-icon')) return 'icon';
        if (child.classList.contains('et-empty-state-title')) return 'title';
        if (child.classList.contains('et-empty-state-description')) return 'description';
        if (child.hasAttribute('etEmptyStateAction')) return 'action';

        return child.tagName.toLowerCase();
      }),
    );

    expect(order).toEqual(['icon', 'title', 'description', 'action']);
  });

  test('the heading renders as a paragraph, not a heading element', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const title = root.locator(TITLE);

    await expect(title).toHaveText('No results');
    await expect(title).toHaveJSProperty('tagName', 'P');
    await expect(root.getByRole('heading')).toHaveCount(0);
  });

  test('the description renders as a paragraph', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const description = root.locator(DESCRIPTION);

    await expect(description).toHaveText('Try a different search term or clear your filters.');
    await expect(description).toHaveJSProperty('tagName', 'P');
  });

  test('the empty state carries no role or live region of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const emptyState = root.locator(EMPTY_STATE);

    await expect(emptyState).not.toHaveAttribute('role', /.*/);
    await expect(emptyState).not.toHaveAttribute('aria-live', /.*/);
    await expect(emptyState).not.toHaveAttribute('tabindex', /.*/);
  });

  test('an unlabelled icon is hidden from assistive technology', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const icon = root.locator(ICON);

    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(icon).not.toHaveAttribute('role', /.*/);
  });

  test('the errored story keeps the same structure with its own copy', async ({ page }) => {
    const root = await openStory(page, ERRORED_STORY_ID);

    await expect(root.locator(TITLE)).toHaveText('Something went wrong');
    await expect(root.locator(DESCRIPTION)).toHaveText('We could not load this data. Please try again.');

    await pressKey(page, 'Tab');

    await expectFocusVisible(root.locator(ACTION));
  });

  test('an empty state without an action still renders its title and description', async ({ page }) => {
    const root = await openStory(page, WITHOUT_ACTION_STORY_ID);

    await expect(root.locator(TITLE)).toHaveText('No results');
    await expect(root.locator(DESCRIPTION)).toHaveText('Try a different search term or clear your filters.');
  });
});

test.describe('empty-state / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter activates the focused action', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const action = root.locator(ACTION);

    await action.focus();
    await countClicks(action);

    await pressKey(page, 'Enter');

    await expect(action).toHaveJSProperty('__clicks', 1);
  });

  test('Space activates the focused action', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const action = root.locator(ACTION);

    await action.focus();
    await countClicks(action);

    await pressKey(page, 'Space');

    await expect(action).toHaveJSProperty('__clicks', 1);
  });

  test('activating the action leaves focus and the empty state in place', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const action = root.locator(ACTION);

    await action.focus();
    await pressKey(page, 'Enter');

    await expect(action).toBeFocused();
    await expect(root.locator(EMPTY_STATE)).toBeVisible();
  });

  test('Escape does not activate the action', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const action = root.locator(ACTION);

    await action.focus();
    await countClicks(action);

    await pressKey(page, 'Escape');

    await expect(action).toHaveJSProperty('__clicks', 0);
    await expect(root.locator(EMPTY_STATE)).toBeVisible();
  });
});

test.describe('empty-state / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap activates the projected action', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const action = root.locator(ACTION);

    await countClicks(action);

    await tap(action);

    await expect(action).toHaveJSProperty('__clicks', 1);
  });

  test('a tap on the title or the icon does not activate the action', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const action = root.locator(ACTION);

    await countClicks(action);

    await tap(root.locator(TITLE));
    await tap(root.locator(ICON));

    await expect(action).toHaveJSProperty('__clicks', 0);
    await expect(root.locator(EMPTY_STATE)).toBeVisible();
  });

  test('an empty state without an action renders no tap target', async ({ page }) => {
    const root = await openStory(page, WITHOUT_ACTION_STORY_ID);

    await expect(root.locator(EMPTY_STATE)).toBeVisible();
    await expect(root.locator(ACTION)).toHaveCount(0);
  });
});
