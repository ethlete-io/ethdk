import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, settle, tap } from '../support';

const SINGLE_ELIMINATION_ID = 'components-sports-bracket--single-elimination';
const PARTICIPANT_FOCUS_ID = 'components-sports-bracket--participant-focus';
const DENSITY_DEFAULT_ID = 'components-sports-bracket-density--default';
const DENSITY_COMPACT_ID = 'components-sports-bracket-density--compact';
const ADAPTIVE_WIDE_ID = 'components-sports-bracket-adaptive--wide';
const PANEL_STORY_ID = 'components-sports-bracket-adaptive--one-round-panel';

const MATCH_CELL = '.et-bracket-element--match';
const ACTIVE = 'et-bracket-journey-active';
const JOURNEY_HOVER = /et-bracket-host--journey-hover/;
const JOURNEY_FOCUSED = /et-bracket-host--journey-focused/;

interface JourneyState {
  activeCells: number[];
  activePaths: number;
  sharedParticipants: string[];
}

function readJourney(root: Locator): Promise<JourneyState> {
  return root.evaluate((host, active) => {
    const cells = Array.from(host.querySelectorAll('.et-bracket-element--match'));
    const lit = cells.filter((cell) => cell.classList.contains(active));
    const shortIds = (cell: Element) => Array.from(cell.classList).filter((cls) => /^p\d+$/.test(cls));
    const [first, ...rest] = lit.map(shortIds);

    return {
      activeCells: lit.map((cell) => cells.indexOf(cell)),
      activePaths: host.querySelectorAll(`.et-bracket-svg path.${active}`).length,
      sharedParticipants: (first ?? []).filter((id) => rest.every((ids) => ids.includes(id))),
    };
  }, ACTIVE);
}

function opacityOf(locator: Locator) {
  return locator.evaluate((el) => Number(getComputedStyle(el).opacity));
}

async function hoverCardChrome(page: Page, cell: Locator) {
  const box = await boxOf(cell);

  await page.mouse.move(box.x + 3, box.y + 3);
}

/** A viewport point inside `et-bracket` whose topmost element is not a match cell. */
async function emptyBracketPoint(page: Page) {
  const point = await page.locator('et-bracket').evaluate((bracket) => {
    const rect = bracket.getBoundingClientRect();

    for (let y = rect.top + 4; y < rect.bottom; y += 8) {
      for (let x = rect.left + 4; x < Math.min(rect.right, window.innerWidth); x += 8) {
        const hit = document.elementFromPoint(x, y);

        if (hit && bracket.contains(hit) && !hit.closest('.et-bracket-element')) return { x, y };
      }
    }

    return null;
  });

  if (!point) throw new Error('the bracket has no empty space in the viewport');

  return point;
}

async function pinFirstParticipant(root: Locator) {
  const first = root.getByRole('group', { name: 'Participants' }).getByRole('button').first();

  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  return first;
}

test.describe('bracket / journey highlight', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: there is no hover on touch');

  test('pointing at one side lights that participant alone and dims the rest', async ({ page }) => {
    const root = await openStory(page, SINGLE_ELIMINATION_ID);
    const cells = root.locator(MATCH_CELL);

    await cells.first().locator('[data-participant-id]').first().hover();

    await expect(root.locator('et-bracket')).toHaveClass(JOURNEY_HOVER);

    const journey = await readJourney(root);

    expect(journey.activeCells).toContain(0);
    expect(journey.activeCells.length).toBeGreaterThan(1);
    expect(journey.sharedParticipants).toHaveLength(1);
    expect(journey.activePaths).toBeGreaterThan(0);

    const unlit = cells.nth(1);

    await expect(unlit).not.toHaveClass(new RegExp(ACTIVE));
    await expect.poll(() => opacityOf(unlit)).toBe(0.5);
    await expect.poll(() => opacityOf(cells.first())).toBe(1);
  });

  test('pointing at the card chrome lights both participants of the match', async ({ page }) => {
    const root = await openStory(page, SINGLE_ELIMINATION_ID);
    const firstCell = root.locator(MATCH_CELL).first();

    await firstCell.locator('[data-participant-id]').nth(1).hover();
    await expect.poll(async () => (await readJourney(root)).activeCells).toEqual([0]);

    await hoverCardChrome(page, firstCell);

    await expect.poll(async () => (await readJourney(root)).activeCells.length).toBeGreaterThan(1);
    expect((await readJourney(root)).activeCells).toContain(0);
  });

  test('the side that went out ends its journey on a struck-through row inside an outlined cell', async ({ page }) => {
    const root = await openStory(page, SINGLE_ELIMINATION_ID);
    const firstCell = root.locator(MATCH_CELL).first();

    await firstCell.locator('[data-participant-id]').nth(1).hover();

    await expect(firstCell).toHaveClass(/et-bracket-journey-endpoint/);
    await expect(firstCell).toHaveCSS('outline-style', 'dashed');

    const eliminated = firstCell.locator('.et-bracket-journey-eliminated');

    await expect(eliminated).toHaveCount(1);
    await expect(eliminated).toHaveCSS('text-decoration-line', 'line-through');
    expect((await readJourney(root)).activeCells).toEqual([0]);
  });

  test('the pointer leaving the bracket clears the highlight', async ({ page }) => {
    const root = await openStory(page, SINGLE_ELIMINATION_ID);
    const bracket = root.locator('et-bracket');

    await root.locator(MATCH_CELL).first().locator('[data-participant-id]').first().hover();
    await expect(bracket).toHaveClass(JOURNEY_HOVER);

    await page.mouse.move(1, 1);

    await expect(bracket).not.toHaveClass(JOURNEY_HOVER);
    await expect(root.locator(`.${ACTIVE}`)).toHaveCount(0);
    await expect.poll(() => opacityOf(root.locator(MATCH_CELL).nth(1))).toBe(1);
  });

  test('disableJourneyHighlight leaves the bracket untouched under the pointer', async ({ page }) => {
    const root = await openStory(page, SINGLE_ELIMINATION_ID, { args: { disableJourneyHighlight: true } });

    await root.locator(MATCH_CELL).first().locator('[data-participant-id]').first().hover();
    await settle(page, 150);

    await expect(root.locator('et-bracket')).not.toHaveClass(JOURNEY_HOVER);
    await expect(root.locator(`.${ACTIVE}`)).toHaveCount(0);
  });
});

test.describe('bracket / dropping the pin', () => {
  test('a click on empty bracket space drops the pin and un-presses the toggle', async ({ isMobile, page }) => {
    test.skip(isMobile, 'pointer-only: mouse click');

    const root = await openStory(page, PARTICIPANT_FOCUS_ID);
    const toggle = await pinFirstParticipant(root);
    const point = await emptyBracketPoint(page);

    await page.mouse.click(point.x, point.y);

    await expect(root.locator('et-bracket')).not.toHaveClass(JOURNEY_FOCUSED);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('a click on a match cell keeps the pin', async ({ isMobile, page }) => {
    test.skip(isMobile, 'pointer-only: mouse click');

    const root = await openStory(page, PARTICIPANT_FOCUS_ID);
    const toggle = await pinFirstParticipant(root);

    await root.locator(MATCH_CELL).first().click();
    await settle(page, 150);

    await expect(root.locator('et-bracket')).toHaveClass(JOURNEY_FOCUSED);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('a tap on empty bracket space drops the pin, a tap on a cell does not', async ({ isMobile, page }) => {
    test.skip(!isMobile, 'touch-only: tap');

    const root = await openStory(page, PARTICIPANT_FOCUS_ID);
    const bracket = root.locator('et-bracket');
    const toggle = root.getByRole('group', { name: 'Participants' }).getByRole('button').first();

    await tap(toggle);
    await expect(bracket).toHaveClass(JOURNEY_FOCUSED);

    await tap(root.locator(MATCH_CELL).first());
    await expect(bracket).toHaveClass(JOURNEY_FOCUSED);

    const point = await emptyBracketPoint(page);

    await page.touchscreen.tap(point.x, point.y);

    await expect(bracket).not.toHaveClass(JOURNEY_FOCUSED);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('bracket / focusRoundId', () => {
  test('stepping the focused round slides each round to the inline start, focusInset in', async ({ page }) => {
    const root = await openStory(page, PANEL_STORY_ID, { args: { focusInset: 40 } });
    const rounds = root.locator('.et-bracket-round');
    const offsetOf = async (round: Locator) =>
      Math.round((await boxOf(round)).x - (await boxOf(root.getByTestId('panel'))).x);

    await expect.poll(() => offsetOf(rounds.nth(0))).toBe(41);

    await root.getByTestId('next-round').click();
    await expect(root.getByTestId('focused-round')).toHaveText('se-r1');
    await expect.poll(() => offsetOf(rounds.nth(1))).toBe(41);

    await root.getByTestId('next-round').click();
    await expect.poll(() => offsetOf(rounds.nth(2))).toBe(41);

    await root.getByTestId('previous-round').click();
    await expect.poll(() => offsetOf(rounds.nth(1))).toBe(41);
  });
});

test.describe('bracket / fitting the measured width', () => {
  test('the container measured on the page decides between the grid and the rounds list', async ({
    isMobile,
    page,
  }) => {
    test.skip(isMobile, 'desktop-only: resizes a desktop viewport');

    const root = await openStory(page, ADAPTIVE_WIDE_ID);
    const host = root.locator('et-sb-bracket-adaptive');

    await expect(root.locator('et-bracket')).toBeVisible();
    await expect(root.locator('et-bracket-rounds-list')).toHaveCount(0);

    await page.setViewportSize({ width: 800, height: 720 });

    await expect(root.locator('et-bracket-rounds-list')).toBeVisible();
    await expect(root.locator('et-bracket')).toHaveCount(0);

    const measured = await host.evaluate((el) => Math.round(el.clientWidth));

    await expect(root.locator('p').first()).toContainText(`${measured}px available`);
  });

  test('a phone-width screen gets the rounds list for a bracket that fits a desktop', async ({ isMobile, page }) => {
    test.skip(!isMobile, 'touch-only: the phone viewport');

    const root = await openStory(page, ADAPTIVE_WIDE_ID);

    await expect(root.locator('et-bracket-rounds-list')).toBeVisible();
    await expect(root.locator('et-bracket')).toHaveCount(0);
  });
});

test.describe('bracket / card layout', () => {
  test('the final at size auto is the featured card in its wide column', async ({ page }) => {
    const root = await openStory(page, SINGLE_ELIMINATION_ID);
    const cells = root.locator(MATCH_CELL);
    const finalCard = cells.last().locator('.et-match-card');

    await expect(finalCard).toHaveAttribute('data-size', 'auto');
    await expect(finalCard.locator('.et-match-card-meta')).toHaveCSS('display', 'flex');
    await expect(cells.first().locator('.et-match-card-meta')).toHaveCSS('display', 'none');

    const finalEmblem = (await boxOf(finalCard.locator('.et-match-participant-emblem').first())).width;
    const roundEmblem = (await boxOf(cells.first().locator('.et-match-participant-emblem').first())).width;

    expect(finalEmblem).toBeGreaterThan(roundEmblem);
  });

  test('a narrow final column drops the final to the dense row instead of cropping it', async ({ page }) => {
    const root = await openStory(page, SINGLE_ELIMINATION_ID, { args: { finalColumnWidth: 200 } });
    const finalCard = root.locator(MATCH_CELL).last().locator('.et-match-card');

    await expect(finalCard.locator('.et-match-card-meta')).toHaveCSS('display', 'none');

    const overflow = await finalCard.evaluate((el) => el.scrollWidth - el.clientWidth);

    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('a compact bracket drops the emblems, the default one keeps them', async ({ page }) => {
    const compact = await openStory(page, DENSITY_COMPACT_ID);
    const compactCell = compact.locator(MATCH_CELL).first();

    expect((await boxOf(compactCell)).width).toBeLessThan(150);
    await expect(compactCell.locator('.et-match-participant-emblem').first()).toHaveCSS('display', 'none');

    const regular = await openStory(page, DENSITY_DEFAULT_ID);
    const regularCell = regular.locator(MATCH_CELL).first();

    expect((await boxOf(regularCell)).width).toBeGreaterThanOrEqual(150);
    await expect(regularCell.locator('.et-match-participant-emblem').first()).not.toHaveCSS('display', 'none');
  });
});
