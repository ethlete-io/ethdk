import { Page } from '@playwright/test';
import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, expect, seedWorld, test } from './support';

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
