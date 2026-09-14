import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** Two in the afternoon on the seeded day. The browser is pinned to UTC, so this is 14:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T14:00:00.000Z`).getTime() + minutes * 60_000);

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/** A meeting the calendar held, then a call it never did. Both are calls the microphone heard. */
const EVENTS: CollectedEvent[] = [
  {
    at: at(0),
    until: at(60),
    source: 'calendar',
    kind: 'calendar-event',
    occurrenceId: 'o-refinement',
    title: 'ABC-2000 Refinement',
    accepted: true,
  },
  { at: at(0), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Refinement - Discord' },
  { at: at(1), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(50), source: 'call', kind: 'call-end', appId: HELPER },
  { at: at(90), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Open Room #1 | Braune Digital' },
  { at: at(91), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(130), source: 'call', kind: 'call-end', appId: HELPER },
];

const settings = () => ({
  ...defaultSettings(),
  callRules: { countsAsWork: ['Discord'], neverCountsAsWork: [] },
  nudge: { ...defaultSettings().nudge, enabled: false },
});

const headers = (page: import('@playwright/test').Page) => page.locator('[data-lane-header]');

test.describe('a meeting and a call the calendar never held', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: EVENTS, settings: settings() });
    await page.goto('/day');
  });

  test('draw in one lane, because a meeting is a call the calendar could name', async ({ page }) => {
    await expect(page.locator('[data-lane] [data-kind="row"]')).toHaveCount(2);
    await expect(headers(page).filter({ hasText: 'Calls' })).toHaveCount(1);

    const titles = await headers(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')));
    const lane = page.locator('[data-lane]').nth(titles.indexOf('lane:call'));

    await expect(lane.locator('[data-kind="row"]')).toHaveCount(2);
  });
});
