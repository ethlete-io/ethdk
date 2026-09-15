import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, openDayNotes, seedWorld, test } from './support';

/** Two in the afternoon on the seeded day. The browser is pinned to UTC, so this is 14:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T14:00:00.000Z`).getTime() + minutes * 60_000);

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/** A room the microphone is still in: a start with no end, and a later focus somewhere else. */
const OPEN_ROOM: CollectedEvent[] = [
  { at: at(0), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Open Room #1 | Braune Digital' },
  { at: at(1), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(20), source: 'window', kind: 'window-focus', appId: 'code', title: 'calls.ts - ethlete-sdk - Code' },
];

const settings = () => ({ ...defaultSettings(), nudge: { ...defaultSettings().nudge, enabled: false } });

const callSpan = (page: import('@playwright/test').Page) => page.locator(`[data-call="${HELPER}"]`);

test.describe('a call the store holds no end for', () => {
  test('keeps running when the host that opened it is still watching', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: OPEN_ROOM,
      settings: settings(),
      callSource: { kind: 'linux-pipewire', watchingSinceMs: at(-60).getTime() },
    });
    await page.goto('/day');
    await openDayNotes(page);

    await expect(callSpan(page)).toContainText('02:01 PM – 06:00 PM');
  });

  test('is cut where the watching stopped when the host that opened it is gone', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: OPEN_ROOM,
      settings: settings(),
      callSource: { kind: 'linux-pipewire', watchingSinceMs: at(30).getTime() },
    });
    await page.goto('/day');
    await openDayNotes(page);

    await expect(callSpan(page)).toContainText('02:01 PM – 02:20 PM');
  });
});
