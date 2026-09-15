import { CollectedEvent } from '@ethlete/timetrack';
import {
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  E2E_PARENT_ID,
  E2E_PARENT_KEY,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** Two in the afternoon on the seeded day. The browser is pinned to UTC, so this is 14:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T14:00:00.000Z`).getTime() + minutes * 60_000);

const HELPER = 'com.hnc.Discord.helper.Renderer';

/** A weekly meeting the user already answered for its series, and the call the day observed over it. */
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

const settings = () => ({
  ...defaultSettings(),
  callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] },
  nudge: { ...defaultSettings().nudge, enabled: false },
  meetingNamings: [{ seriesKey: 'weekly', issueKey: E2E_ISSUE_KEY, title: 'Weekly sync', createdAt: at(-60) }],
});

const issues = (updated: string) => [
  { id: E2E_ISSUE_ID, key: E2E_ISSUE_KEY, summary: 'User management', issueType: 'Task', updated },
  { id: E2E_PARENT_ID, key: E2E_PARENT_KEY, summary: 'Member onboarding', issueType: 'Story', updated: E2E_NOW },
];

const seed = (page: Page, updated: string) =>
  seedWorld(page, { now: E2E_NOW, events: EVENTS, settings: settings(), jira: { issues: issues(updated) } });

const warnings = (page: Page) => page.locator('[data-warnings]');

const open = async (page: Page, updated: string) => {
  await seed(page, updated);
  await page.goto('/day');
  await expect(page.locator('[data-kind="row"]').first()).toContainText(E2E_ISSUE_KEY);

  return page.locator('[data-warning="aged-naming"]');
};

test.describe('a remembered answer pointing at a quiet ticket', () => {
  test('is reported on the day that books it, with the ticket and how long it has been quiet', async ({ page }) => {
    const warning = await open(page, '2025-11-01T09:00:00.000Z');

    await warnings(page).locator('summary').click();

    await expect(warning).toBeVisible();
    await expect(warning).toContainText(E2E_ISSUE_KEY);
    await expect(warning).toContainText('Weekly sync');
    await expect(warning).toContainText('284 days');
  });

  test('is left unreported while Jira still records changes on the ticket', async ({ page }) => {
    const warning = await open(page, '2026-08-01T09:00:00.000Z');

    await expect(warning).toHaveCount(0);
  });
});
