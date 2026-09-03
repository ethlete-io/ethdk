import { expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap } from '../support';

const STORY_ID = 'components-sports-bracket-prediction--interactive';

test.describe('bracket prediction / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches a pick and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const firstPick = root.locator('et-bracket-pick-card button').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(firstPick);
  });
});

test.describe('bracket prediction / interaction', () => {
  test('earlier clicks make the final operable', async ({ isMobile, page }) => {
    test.skip(isMobile, 'pointer-only: mouse activation');

    const root = await openStory(page, STORY_ID);
    const cards = root.locator('et-bracket-pick-card');
    const firstPick = cards.nth(0).locator('button').first();
    const secondPick = cards.nth(1).locator('button').first();

    await firstPick.click();
    await expect(firstPick).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.nth(2).locator('button')).toHaveCount(0);

    await secondPick.click();
    await expect(cards.nth(2).locator('button')).toHaveCount(2);
  });

  test('earlier taps make the final operable', async ({ isMobile, page }) => {
    test.skip(!isMobile, 'touch-only: tap activation');

    const root = await openStory(page, STORY_ID);
    const cards = root.locator('et-bracket-pick-card');
    const firstPick = cards.nth(0).locator('button').first();
    const secondPick = cards.nth(1).locator('button').first();

    await tap(firstPick);
    await expect(firstPick).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.nth(2).locator('button')).toHaveCount(0);

    await tap(secondPick);
    await expect(cards.nth(2).locator('button')).toHaveCount(2);
  });
});
