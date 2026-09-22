import { Locator, Page, expect, test } from '@playwright/test';
import { openStory, pressKey, settle, tap } from '../support';

const STORY_ID = 'core-providers-focus-visible-tracker--default';

interface Tracker {
  first: Locator;
  second: Locator;
  output: Locator;
}

async function openTracker(page: Page): Promise<Tracker> {
  const root = await openStory(page, STORY_ID);

  return {
    first: root.getByRole('button', { name: 'First' }),
    second: root.getByRole('button', { name: 'Second' }),
    output: root.getByTestId('focus-visible'),
  };
}

const matchesFocusVisible = (locator: Locator) => locator.evaluate((el) => el.matches(':focus-visible'));

async function expectStaysHidden(page: Page, tracker: Tracker): Promise<void> {
  await settle(page, 50);
  await expect(tracker.output).toHaveText('false');
}

test.describe('core focus-visible tracker / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard after a mouse click');

  test('a click reports pointer focus', async ({ page }) => {
    const tracker = await openTracker(page);

    await tracker.first.click();

    await expect(tracker.first).toBeFocused();
    await expectStaysHidden(page, tracker);
  });

  for (const modifier of ['Control', 'Alt', 'Meta']) {
    test(`a bare ${modifier} after a click keeps pointer focus, like :focus-visible`, async ({ page }) => {
      const tracker = await openTracker(page);

      await tracker.first.click();
      await pressKey(page, modifier);

      await expectStaysHidden(page, tracker);
      expect(await matchesFocusVisible(tracker.first)).toBe(false);
    });
  }

  test('a shortcut with a modifier after a click keeps pointer focus', async ({ page }) => {
    const tracker = await openTracker(page);

    await tracker.first.click();
    await pressKey(page, 'Control+c');

    await expectStaysHidden(page, tracker);
    expect(await matchesFocusVisible(tracker.first)).toBe(false);
  });

  test('a bare Shift after a click keeps pointer focus', async ({ page }) => {
    const tracker = await openTracker(page);

    await tracker.first.click();
    await pressKey(page, 'Shift');

    await expectStaysHidden(page, tracker);
  });

  test('Shift+Tab after a click reports keyboard focus on the element it reaches', async ({ page }) => {
    const tracker = await openTracker(page);

    await tracker.second.click();
    await pressKey(page, 'Shift+Tab');

    await expect(tracker.first).toBeFocused();
    await expect(tracker.output).toHaveText('true');
    expect(await matchesFocusVisible(tracker.first)).toBe(true);
  });

  test('a non-modifier key after a click reports keyboard focus without moving it', async ({ page }) => {
    const tracker = await openTracker(page);

    await tracker.first.click();
    await pressKey(page, 'ArrowRight');

    await expect(tracker.first).toBeFocused();
    await expect(tracker.output).toHaveText('true');
    expect(await matchesFocusVisible(tracker.first)).toBe(true);
  });

  test('a click after keyboard navigation reports pointer focus again', async ({ page }) => {
    const tracker = await openTracker(page);

    await pressKey(page, 'Tab');
    await expect(tracker.output).toHaveText('true');

    await tracker.second.click();

    await expect(tracker.second).toBeFocused();
    await expect(tracker.output).toHaveText('false');
  });
});

test.describe('core focus-visible tracker / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a tap after keyboard navigation reports pointer focus', async ({ page }) => {
    const tracker = await openTracker(page);

    await pressKey(page, 'Tab');
    await expect(tracker.output).toHaveText('true');

    await tap(tracker.second);

    await expect(tracker.output).toHaveText('false');
  });
});
