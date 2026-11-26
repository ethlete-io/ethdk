import { CALL_LANE_KEY, CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_KEY, E2E_PARENT_KEY, defaultSettings } from '@ethlete/timetrack/testing';
import { Locator, Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, editSurface, expect, seedWorld, test } from './support';

/** Two in the afternoon on the seeded day. The browser is pinned to UTC, so this is 14:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T14:00:00.000Z`).getTime() + minutes * 60_000);

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/** One call the microphone heard, which is the row this spec opens the picker on. */
const EVENTS: CollectedEvent[] = [
  { at: at(0), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Open Room #1 | Braune Digital' },
  { at: at(1), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(41), source: 'call', kind: 'call-end', appId: HELPER },
];

/** A day earlier the same week, whose reviewer named a call row with the remembered issue. */
const EARLIER_DAY = '2026-08-10';

const settings = () => ({
  ...defaultSettings(),
  callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] },
  nudge: { ...defaultSettings().nudge, enabled: false },
});

const remembered = (page: Page) => page.getByRole('group', { name: 'Used here before' });

const rest = (page: Page) => page.getByRole('group', { name: 'All issues' });

const optionsFor = (within: Page | Locator, key: string) => within.getByRole('option', { name: new RegExp(key) });

const openTheCallPicker = async (page: Page) => {
  await page.locator('[data-kind="row"]').first().click();
  await expect(editSurface(page)).toBeVisible();
  await editSurface(page).locator('ethlete-issue-select et-select').click();
};

test.describe('a call the lane was named with before', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: EVENTS,
      settings: settings(),
      reviewOverrides: { [EARLIER_DAY]: { 'p-call': { issueKey: E2E_PARENT_KEY, laneKey: CALL_LANE_KEY } } },
    });
    await page.goto('/day');
  });

  test('is offered above the list, and is not repeated inside it', async ({ page }) => {
    await openTheCallPicker(page);

    await expect(optionsFor(page, E2E_ISSUE_KEY)).toBeVisible();
    await expect(optionsFor(remembered(page), E2E_PARENT_KEY)).toBeVisible();
    await expect(optionsFor(page, E2E_PARENT_KEY)).toHaveCount(1);
  });

  test('leaves the rest of the list under a heading of its own', async ({ page }) => {
    await openTheCallPicker(page);

    await expect(optionsFor(remembered(page), E2E_ISSUE_KEY)).toHaveCount(0);
    await expect(optionsFor(rest(page), E2E_ISSUE_KEY)).toBeVisible();
  });
});
