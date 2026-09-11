import { CollectedEvent, E2E_PARENT_KEY, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, saveSurface, seedWorld, test } from './support';

/** Two in the afternoon on the seeded day. The browser is pinned to UTC, so this is 14:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T14:00:00.000Z`).getTime() + minutes * 60_000);

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/** A call the calendar never held: no occurrence covers it, so nothing but the microphone saw it. */
const ROOM: CollectedEvent[] = [
  { at: at(0), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Open Room #1 | Braune Digital' },
  { at: at(1), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(40), source: 'call', kind: 'call-end', appId: HELPER },
];

/** The nudge is off: it opens over the day while the issue picker is, and the picker is the subject. */
const settings = () => ({
  ...defaultSettings(),
  callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] },
  nudge: { ...defaultSettings().nudge, enabled: false },
});

const callNamings = (page: import('@playwright/test').Page) => page.locator('[data-call-naming]');

test.describe('naming a call the calendar never held', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: ROOM, settings: settings() });
  });

  test('remembers the answer against the call itself', async ({ page }) => {
    await page.goto('/day');

    const row = page.locator('[data-kind="row"]').first();

    await row.click();

    const surface = page.locator('et-scheduler-edit-surface');

    await expect(surface).toBeVisible();
    await surface.locator('ethlete-issue-select et-select').click();
    /**
     * The keyboard, not a click: the surface is anchored to the band, and the band redraws while the
     * day polls, so the option's box never settles long enough for Playwright to click it.
     */
    await page.getByRole('option', { name: /ABC-2000/ }).waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(surface.locator('ethlete-issue-select')).toContainText('ABC-2000');

    await saveSurface(page);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Jira' }).click();

    await expect(callNamings(page)).toHaveCount(1);
    await expect(callNamings(page).first()).toContainText('Open Room #1');
    await expect(callNamings(page).first()).toContainText(E2E_PARENT_KEY);
  });

  test('remembers nothing until a row is named', async ({ page }) => {
    await page.goto('/day');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Jira' }).click();

    await expect(callNamings(page)).toHaveCount(0);
  });
});
