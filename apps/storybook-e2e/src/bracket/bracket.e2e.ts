import { expect, test } from '@playwright/test';
import { expectFocusVisible, focusedDescriptor, openStory, pressKey, settle, tap } from '../support';

const STORY_ID = 'components-sports-bracket-prediction--interactive';
const SLOT_SOURCES_STORY_ID = 'components-sports-bracket-prediction--slot-sources';

test.describe('bracket prediction / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches a pick and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const firstPick = root.locator('et-bracket-pick-card button').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(firstPick);
  });

  test('the focus ring is drawn inside the row, so the card cannot clip it away', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const firstPick = root.locator('et-bracket-pick-card button').first();

    await pressKey(page, 'Tab');

    const offset = await firstPick.evaluate((el) => Number.parseFloat(getComputedStyle(el).outlineOffset));

    expect(offset).toBeLessThan(0);
  });

  test('Tab walks the selectable sides and skips the card that has none', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const cards = root.locator('et-bracket-pick-card');

    await expect(cards.locator('button')).toHaveCount(8);

    for (const quarterFinal of [0, 1, 2, 3]) {
      await expect(cards.nth(quarterFinal).locator('button')).toHaveCount(2);
    }

    for (const laterRound of [4, 5, 6]) {
      await expect(cards.nth(laterRound).locator('button')).toHaveCount(0);
    }

    const reached: string[] = [];

    for (let i = 0; i < 9; i++) {
      await pressKey(page, 'Tab');

      const descriptor = await focusedDescriptor(page);

      reached.push(descriptor.tag);
    }

    expect(reached).toEqual([...Array<string>(8).fill('BUTTON'), 'BODY']);
  });

  test('a side that cannot be picked is not focusable', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const unpickableSides = root.locator('et-bracket-pick-card').nth(6).locator('.et-bracket-pick-card-side');

    await expect(unpickableSides).toHaveCount(2);

    for (const side of await unpickableSides.all()) {
      await side.evaluate((el) => (el as HTMLElement).focus());
      await expect(side).not.toBeFocused();
    }
  });

  test('Space picks the focused side', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const firstPick = root.locator('et-bracket-pick-card button').first();

    await pressKey(page, 'Tab');
    await pressKey(page, 'Space');

    await expect(firstPick).toHaveAttribute('aria-pressed', 'true');
  });

  test('a card whose sides are all unpickable takes no place in the tab order', async ({ page }) => {
    const root = await openStory(page, SLOT_SOURCES_STORY_ID);

    await expect(root.locator('et-bracket-pick-card').first()).toBeVisible();
    await expect(root.locator('et-bracket-pick-card button')).toHaveCount(0);

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
  });
});

test.describe('bracket pick card / the note', () => {
  test('sits under the card, outside its box, and leaves the card its height', async ({ page }) => {
    const root = await openStory(page, 'components-sports-bracket-prediction--pick-card-states');
    const cards = root.locator('et-bracket-pick-card');
    const geometry = await cards.evaluateAll((elements) =>
      elements.map((card) => {
        const box = card.querySelector('.et-bracket-pick-card-box') as HTMLElement;
        const note = card.querySelector('.et-bracket-pick-card-note');

        return {
          boxHeight: Math.round(box.getBoundingClientRect().height),
          noteInsideBox: note ? box.contains(note) : null,
          noteBelowBox: note ? note.getBoundingClientRect().top >= box.getBoundingClientRect().bottom : null,
        };
      }),
    );
    const withNote = geometry.filter((card) => card.noteInsideBox !== null);

    expect(withNote.length).toBeGreaterThan(0);
    expect(withNote.every((card) => card.noteInsideBox === false && card.noteBelowBox === true)).toBe(true);
    expect(new Set(geometry.map((card) => card.boxHeight)).size).toBe(1);
  });

  test('an invalid note outlines the card, a muted one does not', async ({ page }) => {
    const root = await openStory(page, 'components-sports-bracket-prediction--pick-card-states');

    await expect(root.locator('et-bracket-pick-card[data-note-tone="invalid"]')).toHaveCount(1);
    await expect(
      root.locator('et-bracket-pick-card[data-note-tone="invalid"] .et-bracket-pick-card-invalid-outline'),
    ).toHaveCount(1);
    await expect(
      root.locator('et-bracket-pick-card[data-note-tone="muted"] .et-bracket-pick-card-invalid-outline'),
    ).toHaveCount(0);
  });
});

test.describe('bracket pick card / readonly', () => {
  test('offers no control and dims the side the match decided against', async ({ page }) => {
    const root = await openStory(page, 'components-sports-bracket-prediction--pick-card-states');
    const readonlyCard = root.locator('et-bracket-pick-card[data-readonly]');

    await expect(readonlyCard).toHaveCount(1);
    await expect(readonlyCard.locator('button')).toHaveCount(0);
    await expect(readonlyCard.locator('.et-bracket-pick-card-mark')).toHaveCount(0);

    const opacities = await readonlyCard
      .locator('.et-bracket-pick-card-side')
      .evaluateAll((sides) => sides.map((side) => getComputedStyle(side).opacity));

    expect(opacities.filter((opacity) => Number(opacity) < 1)).toHaveLength(1);
    await expect(readonlyCard.locator('[data-dimmed]')).toHaveCount(1);
  });
});

test.describe('bracket pick card / hover preview', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: there is no hover on touch');

  test('a selectable, unchosen side previews the pick its mark would make', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const unchosen = root.locator('et-bracket-pick-card button[aria-pressed="false"]').first();
    const dotOpacity = () =>
      unchosen.evaluate((el) => {
        const mark = el.querySelector('.et-bracket-pick-card-mark');

        return mark ? Number(getComputedStyle(mark, '::after').opacity) : -1;
      });

    expect(await dotOpacity()).toBe(0);

    await unchosen.hover();

    await expect.poll(dotOpacity).toBeGreaterThan(0);
  });
});

test.describe('bracket prediction / interaction', () => {
  test('picks walk the whole chain up to the final, one round at a time', async ({ isMobile, page }) => {
    test.skip(isMobile, 'pointer-only: mouse activation');

    const root = await openStory(page, STORY_ID);
    const cards = root.locator('et-bracket-pick-card');
    const firstQuarterFinal = cards.nth(0).locator('button').first();

    await firstQuarterFinal.click();
    await expect(firstQuarterFinal).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.nth(4).locator('button')).toHaveCount(0);

    await cards.nth(1).locator('button').first().click();
    await expect(cards.nth(4).locator('button')).toHaveCount(2);
    await expect(cards.nth(6).locator('button')).toHaveCount(0);

    await cards.nth(2).locator('button').first().click();
    await cards.nth(3).locator('button').first().click();
    await expect(cards.nth(5).locator('button')).toHaveCount(2);
    await expect(cards.nth(6).locator('button')).toHaveCount(0);

    await cards.nth(4).locator('button').first().click();
    await cards.nth(5).locator('button').first().click();
    await expect(cards.nth(6).locator('button')).toHaveCount(2);
  });

  test('taps make the next round operable', async ({ isMobile, page }) => {
    test.skip(!isMobile, 'touch-only: tap activation');

    const root = await openStory(page, STORY_ID);
    const cards = root.locator('et-bracket-pick-card');
    const firstQuarterFinal = cards.nth(0).locator('button').first();

    await tap(firstQuarterFinal);
    await expect(firstQuarterFinal).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.nth(4).locator('button')).toHaveCount(0);

    await tap(cards.nth(1).locator('button').first());
    await expect(cards.nth(4).locator('button')).toHaveCount(2);
  });
});

test.describe('bracket prediction / journey highlight', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hovering a pick card dims nothing, because a predicted run has nothing to light', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const host = root.locator('.et-bracket-host');

    await root.locator('et-bracket-pick-card [data-participant-id]').first().hover();
    await settle(page, 150);

    await expect(host).not.toHaveClass(/et-bracket-host--journey-hover/);
    await expect(root.locator('.et-bracket-journey-active')).toHaveCount(0);
  });
});
