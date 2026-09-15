import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_ISSUE_KEY, E2E_PARENT_KEY, defaultSettings } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, saveSurface, seedWorld, test } from './support';

/** Two in the afternoon on the seeded day. The browser is pinned to UTC, so this is 14:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T14:00:00.000Z`).getTime() + minutes * 60_000);

const HELPER = 'com.hnc.Discord.helper.Renderer';

/**
 * A weekly meeting the user already answered for its series, and a call over it the user also
 * answered for calls of this shape. Both answers are theirs and they name different work.
 */
const EVENTS: CollectedEvent[] = [
  {
    at: at(0),
    until: at(60),
    source: 'calendar',
    kind: 'calendar-event',
    occurrenceId: 'o-weekly',
    recurringEventId: 'weekly',
    title: 'Weekly sync',
    accepted: true,
  },
  { at: at(0), source: 'window', kind: 'window-focus', appId: HELPER, title: 'Open Room #1 | Braune Digital' },
  { at: at(1), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(41), source: 'call', kind: 'call-end', appId: HELPER },
];

/** Wednesday, which is the weekday the seeded day falls on, and 14:01, which is when the call opened. */
const settings = () => ({
  ...defaultSettings(),
  callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] },
  nudge: { ...defaultSettings().nudge, enabled: false },
  meetingNamings: [
    { seriesKey: 'weekly', issueKey: E2E_PARENT_KEY, title: 'Weekly sync', createdAt: at(-60).toISOString() },
  ],
  callNamings: [
    {
      appId: HELPER.toLowerCase(),
      weekday: 3,
      durationBand: '30-60',
      startMinute: 14 * 60 + 1,
      issueKey: E2E_ISSUE_KEY,
      label: 'Open Room #1',
      createdAt: at(-60).toISOString(),
    },
  ],
});

const band = (page: Page) => page.locator('[data-kind="row"]').first();

const dispute = (page: Page) => page.locator('[data-disputed-naming]');

test.describe('a band two answers disagree about', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: EVENTS, settings: settings() });
  });

  test('books the higher answer and names the other one on the band', async ({ page }) => {
    await page.goto('/day');

    await expect(band(page)).toContainText(E2E_ISSUE_KEY);
    await expect(band(page)).toContainText(`or ${E2E_PARENT_KEY}?`);
  });

  test('offers the other answer in one press, and takes it', async ({ page }) => {
    await page.goto('/day');
    await band(page).click();

    const surface = page.locator('et-scheduler-edit-surface');

    await expect(surface).toBeVisible();
    await expect(dispute(page)).toContainText(E2E_PARENT_KEY);

    await dispute(page)
      .getByRole('button', { name: `Use ${E2E_PARENT_KEY}` })
      .click();

    await saveSurface(page);

    await expect(band(page)).toContainText(E2E_PARENT_KEY);
    await expect(band(page)).not.toContainText('or ');
  });

  test('says nothing when both answers name the same work', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: EVENTS,
      settings: {
        ...settings(),
        meetingNamings: [
          { seriesKey: 'weekly', issueKey: E2E_ISSUE_KEY, title: 'Weekly sync', createdAt: at(-60).toISOString() },
        ],
      },
    });
    await page.goto('/day');

    await expect(band(page)).toContainText(E2E_ISSUE_KEY);
    await expect(band(page)).not.toContainText('or ');
  });
});
