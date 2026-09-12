import { Locator, Page, expect, test } from '@playwright/test';
import {
  countClicks,
  expectFocusVisible,
  expectTouchMode,
  focusedDescriptor,
  openStory,
  pressKey,
  tap,
} from '../support';

const DEFAULT_STORY_ID = 'components-sports-match--default';
const COMPACT_STORY_ID = 'components-sports-match--compact';
const HIDDEN_NAMES_STORY_ID = 'components-sports-match--hidden-names';
const EXPANDED_STORY_ID = 'components-sports-match--expanded';
const LIVE_STORY_ID = 'components-sports-match--live';
const SCHEDULED_STORY_ID = 'components-sports-match--scheduled';
const OUTCOME_STORY_ID = 'components-sports-match--outcome';
const POINTS_STORY_ID = 'components-sports-match--points';
const TBD_STORY_ID = 'components-sports-match--tbd';
const STATES_STORY_ID = 'components-sports-match--states';

const FINISHED_CARD_NAME = 'Quarter-final 2: FC Berlin vs. Neon Esports, 2 : 1, 05/02/2026 8:30 PM, Finished';

function card(root: Locator, index = 0): Locator {
  return root.locator('.et-match-card').nth(index);
}

function side(root: Locator, sideName: 'home' | 'away', index = 0): Locator {
  return card(root, index).locator(`.et-match-card-side[data-side="${sideName}"]`);
}

function announcement(root: Locator, index = 0): Locator {
  return card(root, index).locator('.et-match-card-announcement');
}

async function scoreGoal(page: Page, isMobile: boolean | undefined, participant: string): Promise<void> {
  const button = page.getByRole('button', { name: `Goal for ${participant}` });

  if (isMobile) {
    await tap(button);
  } else {
    await button.click();
  }
}

/**
 * Records the highest number of drawn values the score element ever holds, so the crossing of two real
 * elements can be asserted after the roll rather than raced against its 220ms.
 */
async function watchDrawnValues(score: Locator): Promise<void> {
  await score.evaluate((el) => {
    const watched = el as HTMLElement & { __maxDrawnValues: number };
    const count = () => el.querySelectorAll('.et-match-score-digit').length;

    watched.__maxDrawnValues = count();

    new MutationObserver(() => {
      watched.__maxDrawnValues = Math.max(watched.__maxDrawnValues, count());
    }).observe(el, { childList: true });
  });
}

test.describe('match / aria', () => {
  test('an interactive card is one named link with nothing focusable inside it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const matchCard = card(root);

    await expect(matchCard).toHaveJSProperty('tagName', 'A');
    await expect(matchCard).not.toHaveAttribute('role');
    await expect(matchCard).toHaveAccessibleName(FINISHED_CARD_NAME);
    await expect(matchCard.locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
  });

  test('a card that is not a link is a named group', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { interactive: false } });
    const matchCard = card(root);

    await expect(matchCard).toHaveAttribute('role', 'group');
    await expect(matchCard).toHaveAccessibleName(FINISHED_CARD_NAME);
  });

  test('the meta row and the drawn values are hidden from assistive tech', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(card(root).locator('.et-match-card-meta')).toHaveAttribute('aria-hidden', 'true');
    await expect(card(root).locator('et-match-score')).toHaveCount(2);
    await expect(card(root).locator('et-match-score[aria-hidden="true"]')).toHaveCount(2);
  });

  test('the result is announced from a polite, atomic live region that is out of sight', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const region = announcement(root);

    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toHaveAttribute('aria-atomic', 'true');
    await expect(region).toHaveText('2 : 1');

    const box = await region.boundingBox();

    expect(box?.width).toBeLessThanOrEqual(2);
    expect(box?.height).toBeLessThanOrEqual(2);
  });

  test('the live region is in the DOM before there is anything to announce', async ({ page }) => {
    const root = await openStory(page, SCHEDULED_STORY_ID);

    await expect(announcement(root)).toHaveCount(1);
    await expect(announcement(root)).toBeEmpty();
    await expect(announcement(root)).toHaveAttribute('aria-live', 'polite');
  });

  test('outcome letters are drawn but announced as a phrase', async ({ page }) => {
    const root = await openStory(page, OUTCOME_STORY_ID);

    await expect(card(root).locator('.et-match-card-outcome[aria-hidden="true"]')).toHaveText(['W', 'L']);
    await expect(announcement(root)).toHaveText('FC Berlin won');
    await expect(card(root)).toHaveAccessibleName(
      'Quarter-final 2: FC Berlin vs. Neon Esports, FC Berlin won, 05/02/2026 8:30 PM, Finished',
    );
  });

  test('points are announced as what they are', async ({ page }) => {
    const root = await openStory(page, POINTS_STORY_ID);

    await expect(announcement(root)).toHaveText('3 : 0 points');
  });

  test('the series breakdown is an exposed list with every game numbered', async ({ page }) => {
    const root = await openStory(page, EXPANDED_STORY_ID);
    const games = card(root).locator('.et-match-card-games');
    const items = games.locator('.et-match-card-game');

    await expect(games).toHaveRole('list');
    await expect(games).toHaveAccessibleName('Games');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveAttribute('aria-label', 'Game 1: 13 : 11');
    await expect(items.nth(1)).toHaveAttribute('aria-label', 'Game 2: 8 : 13');
    await expect(items.nth(2)).toHaveAttribute('aria-label', 'Game 3: 13 : 9');
  });

  test('emblems and seeds carry names of their own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { showSeeds: true } });

    await expect(side(root, 'home').locator('img')).toHaveAttribute('alt', 'FC Berlin emblem');
    await expect(side(root, 'away').locator('img')).toHaveAttribute('alt', 'Neon Esports emblem');
    await expect(side(root, 'home').locator('.et-match-participant-seed')).toHaveAttribute('aria-label', 'Seed 1');
    await expect(side(root, 'away').locator('.et-match-participant-seed')).toHaveAttribute('aria-label', 'Seed 8');
  });

  test('hideNames drops the names from the drawing only', async ({ page }) => {
    const root = await openStory(page, HIDDEN_NAMES_STORY_ID);

    await expect(card(root).locator('.et-match-participant-names').first()).toBeHidden();
    await expect(side(root, 'home').locator('img')).toHaveAttribute('alt', 'FC Berlin emblem');
    await expect(card(root)).toHaveAccessibleName(/FC Berlin vs\. Neon Esports/);
  });

  test('an undecided slot is drawn and announced as TBD', async ({ page }) => {
    const root = await openStory(page, TBD_STORY_ID);

    await expect(side(root, 'away').locator('.et-match-participant-name')).toHaveText('TBD');
    await expect(card(root)).toHaveAccessibleName(/FC Berlin vs\. TBD/);
  });

  test('the dense row keeps the match label in the composed name', async ({ page }) => {
    const root = await openStory(page, COMPACT_STORY_ID);

    await expect(card(root).locator('.et-match-card-label')).toBeHidden();
    await expect(card(root)).toHaveAccessibleName(/^Quarter-final 2: /);
  });

  test('a drawn kick-off is part of the composed name', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const kickOff = card(root).locator('.et-match-card-time');

    await expect(kickOff).toBeVisible();

    const drawnKickOff = (await kickOff.innerText()).trim();

    expect(await card(root).getAttribute('aria-label')).toContain(drawnKickOff);
  });
});

test.describe('match / states', () => {
  test('an upcoming match draws its kick-off and announces no result', async ({ page }) => {
    const root = await openStory(page, SCHEDULED_STORY_ID);

    await expect(card(root)).toHaveAttribute('data-status', 'scheduled');
    await expect(card(root).locator('.et-match-card-time')).toBeVisible();
    await expect(card(root).locator('.et-match-card-live')).toHaveCount(0);
    await expect(card(root).locator('et-match-score')).toHaveCount(0);
    await expect(announcement(root)).toBeEmpty();
  });

  test('a live match draws its badge instead of its kick-off, even in the dense row', async ({ page }) => {
    const root = await openStory(page, STATES_STORY_ID);
    const liveCard = card(root, 1);

    await expect(liveCard).toHaveAttribute('data-status', 'live');
    await expect(liveCard.locator('.et-match-card-live')).toHaveText('Live');
    await expect(liveCard.locator('.et-match-card-time')).toHaveCount(0);
    await expect(liveCard.locator('.et-match-card-meta')).toBeVisible();
    await expect(card(root, 0).locator('.et-match-card-meta')).toBeHidden();
  });

  test('a finished match marks its winner and announces the result', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(card(root)).toHaveAttribute('data-status', 'finished');
    await expect(card(root)).toHaveAttribute('data-winner', 'home');
    await expect(announcement(root)).toHaveText('2 : 1');
    await expect(card(root)).toHaveAccessibleName(FINISHED_CARD_NAME);
  });
});

test.describe('match / live', () => {
  test('a live match arriving with a score on it does not animate', async ({ page }) => {
    const root = await openStory(page, LIVE_STORY_ID);
    const digits = side(root, 'home').locator('.et-match-score-digit');

    await expect(digits).toHaveCount(1);
    await expect(digits).toHaveAttribute('data-state', 'static');
    await expect(card(root).locator('.et-match-score-flash')).toHaveCount(0);
  });

  test('a goal crosses two real values and leaves one of them behind', async ({ isMobile, page }) => {
    const root = await openStory(page, LIVE_STORY_ID);
    const score = side(root, 'home').locator('et-match-score');
    const digits = score.locator('.et-match-score-digit');

    await watchDrawnValues(score);
    await scoreGoal(page, isMobile, 'FC Berlin');

    await expect(score).toHaveJSProperty('__maxDrawnValues', 2);
    await expect(digits).toHaveText(['3']);
    await expect(digits).toHaveAttribute('data-state', 'static');
    await expect(card(root).locator('.et-match-score-flash')).toHaveCount(0);
  });

  test('a goal is announced once, as the whole new score', async ({ isMobile, page }) => {
    const root = await openStory(page, LIVE_STORY_ID);

    await expect(announcement(root)).toHaveText('2 : 1');

    await scoreGoal(page, isMobile, 'FC Berlin');

    await expect(announcement(root)).toHaveText('3 : 1');
    await expect(announcement(root)).toHaveAttribute('aria-atomic', 'true');
    await expect(card(root)).toHaveAccessibleName(/, 3 : 1, Live$/);
  });

  test('animateScoreChanges off keeps the announcement without the movement', async ({ isMobile, page }) => {
    const root = await openStory(page, LIVE_STORY_ID, { args: { animateScoreChanges: false } });
    const score = side(root, 'home').locator('et-match-score');

    await watchDrawnValues(score);
    await scoreGoal(page, isMobile, 'FC Berlin');

    await expect(announcement(root)).toHaveText('3 : 1');
    await expect(score.locator('.et-match-score-digit')).toHaveText(['3']);
    await expect(score).toHaveJSProperty('__maxDrawnValues', 1);
  });
});

test.describe('match / reduced motion', () => {
  test('the live badge stops pulsing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, LIVE_STORY_ID);

    await expect(card(root).locator('.et-match-card-live-dot')).toHaveCSS('animation-name', 'none');
  });

  test('a goal swaps the score instantly, with no flash', async ({ isMobile, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, LIVE_STORY_ID);
    const digits = side(root, 'home').locator('.et-match-score-digit');

    await scoreGoal(page, isMobile, 'FC Berlin');

    await expect(announcement(root)).toHaveText('3 : 1');
    await expect(digits).toHaveText(['3']);
    await expect(card(root).locator('.et-match-score-flash')).toHaveCount(0);
  });
});

test.describe('match / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches an interactive card and its focus ring is visible', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    await expectFocusVisible(card(root));
  });

  test('the whole card is a single tab stop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { series: true, showSeeds: true } });

    await pressKey(page, 'Tab');
    await expect(card(root)).toBeFocused();

    await pressKey(page, 'Tab');

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
  });

  test('a card that is not a link is not a tab stop', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { interactive: false } });

    await pressKey(page, 'Tab');

    await expect(card(root)).not.toBeFocused();
    await expect(card(root)).not.toHaveAttribute('tabindex');
  });
});

test.describe('match / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Enter activates a focused card', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const matchCard = card(root);

    await countClicks(matchCard);
    await pressKey(page, 'Tab');
    await expect(matchCard).toBeFocused();

    await pressKey(page, 'Enter');

    await expect(matchCard).toHaveJSProperty('__clicks', 1);
  });

  test('the card adds no key handling of its own', async ({ page }) => {
    const root = await openStory(page, EXPANDED_STORY_ID);
    const matchCard = card(root);

    await countClicks(matchCard);
    await pressKey(page, 'Tab');

    for (const key of ['ArrowRight', 'ArrowDown', 'Home', 'End']) {
      await pressKey(page, key);
      await expect(matchCard).toBeFocused();
    }

    await expect(matchCard).toHaveJSProperty('__clicks', 0);
  });
});

test.describe('match / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap activation');

  test('a tap on an interactive card activates it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const matchCard = card(root);

    await expectTouchMode(page);
    await countClicks(matchCard);

    await tap(matchCard);

    await expect(matchCard).toHaveJSProperty('__clicks', 1);
  });

  test('a tap anywhere inside the card is a tap on the card', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const matchCard = card(root);

    await countClicks(matchCard);

    await tap(side(root, 'home').locator('.et-match-participant-picture'));

    await expect(matchCard).toHaveJSProperty('__clicks', 1);
  });
});
