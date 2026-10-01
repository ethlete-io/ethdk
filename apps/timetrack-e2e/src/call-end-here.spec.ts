import { Locator, Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, editSurface, expect, saveSurface, seedWorld, test } from './support';

/** Four in the afternoon on the seeded day. The browser is pinned to UTC, so this is 16:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T16:00:00.000Z`).getTime() + minutes * 60_000);

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/** A meeting the calendar never held that went on as small talk: the microphone is still open. */
const OPEN_MEETING: CollectedEvent[] = [
  { at: at(0), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Meeting #1 | Braune Digital - Discord' },
  { at: at(1), source: 'call', kind: 'call-start', appId: HELPER },
];

const settings = () => ({
  ...defaultSettings(),
  callRules: { countsAsWork: ['Discord'], neverCountsAsWork: [] },
  nudge: { ...defaultSettings().nudge, enabled: false },
});

const open = async (page: Page, now: Date) => {
  await seedWorld(page, {
    now,
    events: OPEN_MEETING,
    settings: settings(),
    callSource: { kind: 'linux-pipewire', watchingSinceMs: at(-60).getTime() },
  });
  await page.goto('/day');
};

const bands = (page: Page) => page.locator('[data-lane] [data-kind="row"]');

const item = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });

const endHere = async (page: Page) => {
  await bands(page).first().click({ button: 'right' });
  await item(page, 'End here').click();
  await expect(page.locator('et-menu')).toBeHidden();
};

test.describe('a call row that still grows', () => {
  test('ends on the quarter nearest now, and the call it runs on for is a band of its own', async ({ page }) => {
    await open(page, at(127));
    await expect(bands(page)).toHaveCount(1);
    await expect(bands(page).first()).toHaveAttribute('title', /· 2h 15m$/);

    await endHere(page);

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', /· 2h 0m$/);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 15m$/);
  });

  test('stays ended while the call runs on, and offers no second end', async ({ page }) => {
    await open(page, at(130));
    await expect(bands(page)).toHaveCount(1);

    await endHere(page);
    await page.clock.runFor(60 * 60_000);

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', /· 2h 15m$/);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 1h 0m$/);
    await bands(page).first().click({ button: 'right' });
    await expect(item(page, 'Split in half')).toBeVisible();
    await expect(item(page, 'End here')).toBeHidden();
  });

  test('is not offered on a call that already closed', async ({ page }) => {
    await seedWorld(page, {
      now: at(180),
      events: [...OPEN_MEETING, { at: at(60), source: 'call', kind: 'call-end', appId: HELPER }],
      settings: settings(),
      callSource: { kind: 'linux-pipewire', watchingSinceMs: at(-60).getTime() },
    });
    await page.goto('/day');

    await bands(page).first().click({ button: 'right' });
    await expect(item(page, 'Split in half')).toBeVisible();
    await expect(item(page, 'End here')).toBeHidden();
  });
});

const weekly = (until: Date): CollectedEvent => ({
  at: at(0),
  until,
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: 'o-weekly',
  title: 'ABC-2000 Weekly',
  accepted: true,
  conferenceUrl: 'https://call.example.com/qzx-room-71',
});

/** The same call, over a meeting the calendar held until 16:45: the rest of the call was small talk. */
const OVERRUN_MEETING: CollectedEvent[] = [weekly(at(45)), ...OPEN_MEETING];

const cut = (page: Page) => page.getByRole('button', { name: 'End here', exact: true });
const follow = (page: Page) => page.getByRole('button', { name: 'Follow the call again', exact: true });

/** Drags a band's end up by 20px, the way a hand resize does. */
const dragEnd = async (page: Page, band: Locator) => {
  const { x, y } = await band.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return { x: rect.x + 20, y: rect.bottom - 2 };
  });

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 10);
  await page.mouse.move(x, y - 20);
  await page.mouse.up();
};

const seedCall = (page: Page, options: { now: Date; events?: CollectedEvent[] }) =>
  seedWorld(page, {
    now: options.now,
    events: options.events ?? OPEN_MEETING,
    settings: settings(),
    callSource: { kind: 'linux-pipewire', watchingSinceMs: at(-60).getTime() },
  });

/**
 * Names the growing call by hand. The keyboard, not a click: the band redraws while the day polls, so
 * the option's box never settles long enough for Playwright to click it.
 */
const nameTheCall = async (page: Page) => {
  await bands(page).first().click();
  await expect(editSurface(page)).toBeVisible();
  await editSurface(page).locator('ethlete-issue-select et-select').click();
  await page.getByRole('option', { name: /ABC-2000/ }).waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await saveSurface(page);
  await expect(bands(page).first()).toHaveAttribute('title', /^ABC-2000 · /);
};

test.describe('the cut line of a named call row that still grows', () => {
  test.beforeEach(async ({ page }) => {
    await seedCall(page, { now: at(60) });
    await page.goto('/day');
    await nameTheCall(page);
  });

  test('sits one quarter before the end, and a press ends the row there', async ({ page }) => {
    await expect(bands(page)).toHaveCount(1);
    await expect(bands(page).first()).toHaveAttribute('title', /· 1h 0m$/);
    await expect(bands(page).first()).toHaveAttribute('data-growing');
    await expect(cut(page)).toContainText(/(16|04):45/);

    await cut(page).click();

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', /· 45m$/);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 15m$/);
    await expect(bands(page).first()).not.toHaveClass(/et-color--warning/);
    await expect(bands(page).last()).toHaveClass(/et-color--warning/);
    await expect(cut(page)).toHaveCount(0);
    await expect(follow(page)).toBeVisible();
    await expect(bands(page).first()).not.toHaveAttribute('data-growing');
  });

  test('keeps one rest band that grows with the call, with no cut line of its own', async ({ page }) => {
    await cut(page).click();
    await expect(bands(page)).toHaveCount(2);

    await page.clock.runFor(30 * 60_000);

    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 45m$/);
    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', /· 45m$/);
    await expect(bands(page).last()).toHaveClass(/et-color--warning/);
    await expect(cut(page)).toHaveCount(0);
    await expect(follow(page)).toBeVisible();
  });

  test('lets the row follow the call again from the seam', async ({ page }) => {
    await cut(page).click();
    await expect(bands(page)).toHaveCount(2);

    await follow(page).click();

    await expect(bands(page)).toHaveCount(1);
    await expect(bands(page).first()).toHaveAttribute('title', /· 1h 0m$/);
    await expect(follow(page)).toHaveCount(0);
    await expect(cut(page)).toBeVisible();
  });

  test('offers no end on the rest, and keeps it one band when its end is dragged', async ({ page }) => {
    await cut(page).click();
    await page.clock.runFor(30 * 60_000);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 45m$/);

    await bands(page).last().click({ button: 'right' });
    await expect(item(page, 'Split in half')).toBeVisible();
    await expect(item(page, 'End here')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('et-menu')).toBeHidden();

    await dragEnd(page, bands(page).last());
    await page.clock.runFor(15 * 60_000);

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 1h 0m$/);
    await expect(follow(page)).toBeVisible();
  });

  test('keeps the rest unnamed in style once the boundary between the two is moved', async ({ page }) => {
    await cut(page).click();
    await expect(bands(page)).toHaveCount(2);

    await page.getByRole('separator', { name: /^Boundary between ABC-2000 and / }).focus();
    await page.keyboard.press('ArrowUp');

    await expect(bands(page).first()).toHaveAttribute('title', /· 30m$/);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 30m$/);
    await expect(bands(page).last()).toHaveClass(/et-color--warning/);
  });

  test('ends and follows again from the keyboard', async ({ page }) => {
    await cut(page).focus();
    await page.keyboard.press('Enter');
    await expect(bands(page)).toHaveCount(2);

    await follow(page).focus();
    await page.keyboard.press('Enter');
    await expect(bands(page)).toHaveCount(1);
  });

  test('moves the end when dragged, and keeps the seam there', async ({ page }) => {
    const { x, y } = await cut(page).evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return { x: rect.x + 20, y: rect.y + rect.height / 2 };
    });

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 10);
    await page.mouse.move(x, y - 20);
    await page.mouse.up();

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', /· 30m$/);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 30m$/);
    await expect(follow(page)).toBeVisible();
  });
});

test('keeps the seam once the call closed, and following it again runs the row to the call end', async ({ page }) => {
  await seedCall(page, {
    now: at(60),
    events: [...OPEN_MEETING, { at: at(75), source: 'call', kind: 'call-end', appId: HELPER }],
  });
  await page.goto('/day');
  await nameTheCall(page);

  await cut(page).click();
  await expect(bands(page)).toHaveCount(2);
  await page.clock.runFor(30 * 60_000);

  await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 30m$/);
  await expect(follow(page)).toBeVisible();

  await expect(bands(page).first()).toHaveAttribute('title', /· 45m$/);
  await follow(page).click();

  await expect(bands(page)).toHaveCount(1);
  await expect(bands(page).first()).toHaveAttribute('title', /· 1h 15m$/);
  await expect(follow(page)).toHaveCount(0);
  await expect(cut(page)).toHaveCount(0);
});

test('a row an earlier version ended keeps one rest band and its seam', async ({ page }) => {
  await seedCall(page, { now: at(60) });
  await page.goto('/day');
  await nameTheCall(page);

  await dragEnd(page, bands(page).first());
  await expect(bands(page)).toHaveCount(2);
  await expect(bands(page).first()).toHaveAttribute('title', /· 45m$/);
  await expect(follow(page)).toHaveCount(0);

  await page.clock.runFor(30 * 60_000);
  await dragEnd(page, bands(page).last());
  await page.clock.runFor(15 * 60_000);

  await expect(bands(page)).toHaveCount(2);
  await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 1h 0m$/);
  await expect(follow(page)).toBeVisible();

  await follow(page).click();

  await expect(bands(page)).toHaveCount(1);
  await expect(bands(page).first()).toHaveAttribute('title', /· 1h 45m$/);
});

test.describe('a call row a calendar meeting names', () => {
  test('is cut where the meeting ended, and keeps no seam to follow the call again', async ({ page }) => {
    await seedCall(page, { now: at(60), events: OVERRUN_MEETING });
    await page.goto('/day');
    await expect(bands(page).first()).toHaveAttribute('title', /^ABC-2000 · 1h 0m$/);
    await expect(cut(page)).toContainText(/(16|04):45/);

    await cut(page).click();

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', /· 45m$/);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 15m$/);
    await expect(follow(page)).toHaveCount(0);
  });

  test('shows no seam once its end is resized by hand', async ({ page }) => {
    await seedCall(page, { now: at(60), events: [weekly(at(30)), ...OPEN_MEETING] });
    await page.goto('/day');
    await expect(bands(page).first()).toHaveAttribute('title', /^ABC-2000 · 1h 0m$/);

    await dragEnd(page, bands(page).first());

    await expect(bands(page)).toHaveCount(2);
    await expect(bands(page).first()).toHaveAttribute('title', /· 45m$/);
    await expect(follow(page)).toHaveCount(0);
  });
});

test('a growing call row nothing named shows the cut line, and ends there', async ({ page }) => {
  await open(page, at(127));
  await expect(bands(page)).toHaveCount(1);
  await expect(bands(page).first()).toHaveAttribute('title', /^Not yet named · 2h 15m$/);
  await expect(bands(page).first()).toHaveAttribute('data-growing');
  await expect(cut(page)).toContainText(/(18|06):00/);

  await cut(page).click();

  await expect(bands(page)).toHaveCount(2);
  await expect(bands(page).first()).toHaveAttribute('title', /^Not yet named · 2h 0m$/);
  await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 15m$/);
  await expect(bands(page).first()).not.toHaveAttribute('data-growing');
  await expect(bands(page).last()).not.toHaveAttribute('data-growing');
  await expect(cut(page)).toHaveCount(0);
});

test('a call row the call already closed shows no cut line', async ({ page }) => {
  await seedCall(page, {
    now: at(180),
    events: [...OVERRUN_MEETING, { at: at(60), source: 'call', kind: 'call-end', appId: HELPER }],
  });
  await page.goto('/day');

  await expect(bands(page)).toHaveCount(1);
  await expect(cut(page)).toHaveCount(0);
  await expect(follow(page)).toHaveCount(0);
  await expect(bands(page).first()).not.toHaveAttribute('data-growing');
});

test.describe('a call row that still grows, marked as not work', () => {
  const skip = async (page: Page, name: string) => {
    await bands(page).first().click({ button: 'right' });
    await item(page, name).click();
    await expect(page.locator('et-menu')).toBeHidden();
  };

  test('stays unlogged while the call runs on', async ({ page }) => {
    await open(page, at(127));
    await expect(bands(page)).toHaveCount(1);

    await skip(page, "Don't log this time");
    await page.clock.runFor(60 * 60_000);

    await expect(bands(page)).toHaveCount(1);
    await expect(bands(page).first()).toHaveAttribute('title', /^Not logged · 3h 15m$/);
  });

  test('is logged again from the same menu', async ({ page }) => {
    await open(page, at(127));
    await skip(page, "Don't log this time");

    await skip(page, 'Log this time');

    await expect(bands(page).first()).toHaveAttribute('title', /· 2h 15m$/);
  });

  test('reads as not logged instead of not yet named, on the rest of an ended call', async ({ page }) => {
    await open(page, at(127));
    await endHere(page);
    await expect(bands(page).last()).toHaveAttribute('title', /^Not yet named · 15m$/);

    await bands(page).last().click({ button: 'right' });
    await item(page, "Don't log this time").click();
    await page.clock.runFor(60 * 60_000);

    await expect(bands(page).last()).toHaveAttribute('title', /^Not logged · 1h 15m$/);
  });
});
