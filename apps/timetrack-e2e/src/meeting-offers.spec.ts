import { CollectedEvent } from '@ethlete/timetrack';
import { Locator, Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, openDayNotes, seedWorld, test } from './support';

/** Two in the afternoon on the seeded day. The browser is pinned to UTC, so this is 14:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T14:00:00.000Z`).getTime() + minutes * 60_000);

const occurrence = (options: { id: string; title: string; from: number; to: number }): CollectedEvent => ({
  at: at(options.from),
  until: at(options.to),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: options.id,
  title: options.title,
  accepted: true,
});

/** An accepted invitation whose own title names the issue, so the card can offer it with one press. */
const REFINEMENT = occurrence({ id: 'o-refinement', title: 'ABC-2000 Refinement', from: 0, to: 60 });

/** One the calendar names no issue for. It is a question the add-entry panel answers, not a press. */
const LUNCH = occurrence({ id: 'o-lunch', title: 'Team lunch', from: 120, to: 180 });

const card = (page: Page) => page.locator('[data-unobserved]');

const offerFor = (page: Page, title: string) => page.locator('[data-unobserved-occurrence]').filter({ hasText: title });

const rows = (page: Page) => page.locator('[data-kind="row"]');

test.describe('a meeting nothing heard', () => {
  test('asks about the occurrence instead of proposing a row for it', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [REFINEMENT] });
    await page.goto('/day');

    await expect(rows(page)).toHaveCount(0);

    await openDayNotes(page);

    await expect(offerFor(page, 'ABC-2000 Refinement')).toContainText(/02:00\sPM\s+\u2013\s+03:00\sPM/);
  });

  test('puts the meeting on the day when one press adopts it', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [REFINEMENT] });
    await page.goto('/day');
    await openDayNotes(page);

    await offerFor(page, 'ABC-2000 Refinement').locator('[data-unobserved-add]').click();

    await expect(rows(page).filter({ hasText: 'ABC-2000' })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: 'by hand' })).toHaveCount(1);
  });

  test('stops asking about a meeting the day already holds', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [REFINEMENT, LUNCH] });
    await page.goto('/day');
    await openDayNotes(page);

    await offerFor(page, 'ABC-2000 Refinement').locator('[data-unobserved-add]').click();

    await expect(offerFor(page, 'ABC-2000 Refinement')).toHaveCount(0);
    await expect(offerFor(page, 'Team lunch')).toHaveCount(1);
  });

  test('offers no press for an occurrence the calendar names no issue for', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [LUNCH] });
    await page.goto('/day');
    await openDayNotes(page);

    const lunch: Locator = offerFor(page, 'Team lunch');

    await expect(lunch.locator('[data-unobserved-unnamed]')).toBeVisible();
    await expect(lunch.locator('[data-unobserved-add]')).toHaveCount(0);
  });
});

test.describe('a meeting a call was heard over', () => {
  const HELPER = 'com.hnc.Discord.helper.Renderer';

  const call = (minutes: number, kind: 'call-start' | 'call-end'): CollectedEvent => ({
    at: at(minutes),
    source: 'call',
    kind,
    appId: HELPER,
  });

  test('asks nothing, because the call is what says the meeting happened', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [
        REFINEMENT,
        { at: at(1), source: 'window', kind: 'window-focus', appId: 'com.hnc.Discord', title: 'Refinement - Discord' },
        call(2, 'call-start'),
        call(50, 'call-end'),
      ],
    });
    await page.goto('/day');
    await openDayNotes(page);

    await expect(page.locator(`[data-call="${HELPER}"]`)).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});
