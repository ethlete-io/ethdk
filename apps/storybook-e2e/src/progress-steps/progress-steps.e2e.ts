import { expect, test } from '@playwright/test';
import { expectFocusVisible, focusedDescriptor, openStory, pressKey, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-navigation-progress-steps--default';
const AS_LINKS_STORY_ID = 'components-navigation-progress-steps--as-links';
const VERTICAL_STORY_ID = 'components-navigation-progress-steps--vertical';
const OUTCOMES_STORY_ID = 'components-navigation-progress-steps--outcomes';

const LINK_STEP = 'a[et-progress-step]';

test.describe('progress-steps / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a plain step is not a link or a button, so Tab finds nothing to focus', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    const focused = await focusedDescriptor(page);
    expect(focused.tag).toBe('BODY');
  });

  test('Tab reaches the first linked step and its focus ring is visible', async ({ page }) => {
    const root = await openStory(page, AS_LINKS_STORY_ID);
    const firstStep = root.locator(LINK_STEP).first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(firstStep);
  });

  test('Tab visits every linked step in DOM order', async ({ page }) => {
    await openStory(page, AS_LINKS_STORY_ID);

    const descriptors = await tabSequence(page, 4);

    expect(descriptors.map((d) => d.text)).toEqual(['Account', 'Shipping', 'Payment', 'Review']);
  });
});

test.describe('progress-steps / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: state and link contract');

  test('a complete step renders a checkmark marker, current and upcoming render a number', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const steps = root.locator('et-progress-step');

    await expect(steps.nth(0).locator('.et-icon')).toHaveCount(1);
    await expect(steps.nth(2).locator('.et-progress-step-marker-number')).toHaveCount(1);
    await expect(steps.nth(3).locator('.et-progress-step-marker-number')).toHaveCount(1);
  });

  test('the three outcome states render their own icon and keep their state on data-state', async ({ page }) => {
    const root = await openStory(page, OUTCOMES_STORY_ID);
    const steps = root.locator('et-progress-step');

    for (const [index, state] of ['success', 'warning', 'error'].entries()) {
      await expect(steps.nth(index)).toHaveAttribute('data-state', state);
      await expect(steps.nth(index).locator('.et-icon')).toHaveCount(1);
    }

    await expect(steps.nth(3)).toHaveAttribute('data-state', 'upcoming');
    await expect(steps.nth(3).locator('.et-progress-step-marker-number')).toHaveCount(1);
  });

  test('Enter activates the focused step, following its href', async ({ page }) => {
    await openStory(page, AS_LINKS_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#account');
  });

  test('the links story renders every step as an anchor with an href', async ({ page }) => {
    const root = await openStory(page, AS_LINKS_STORY_ID);
    const steps = root.locator(LINK_STEP);

    await expect(steps).toHaveCount(4);

    const hrefs = await steps.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual(['#account', '#shipping', '#payment', '#review']);
  });

  test('the vertical story reports its orientation on the host', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);

    await expect(root.locator('et-progress-steps')).toHaveAttribute('data-orientation', 'vertical');
  });
});

test.describe('progress-steps / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on a linked step activates it, following its href', async ({ page }) => {
    const root = await openStory(page, AS_LINKS_STORY_ID);
    const firstStep = root.locator(LINK_STEP).first();

    await tap(firstStep);

    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#account');
  });
});
