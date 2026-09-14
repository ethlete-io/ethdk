import { CollectedEvent } from '@ethlete/timetrack';
import {
  E2E_ISSUE_BRANCH,
  E2E_ISSUE_ID,
  E2E_ISSUE_KEY,
  FakeJiraIssue,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** The checkout the fake git backend discovers, which the branch grammar names the issue in. */
const FUT = '/Users/e2e/dev/fut-frontend';

/** The shared library an agent worked in all morning. It is the band that has to yield. */
const SDK = '/Users/e2e/dev/ethlete-sdk';

const ABC = { key: 'ABC', name: 'Alpha' };
const XYZ = { key: 'XYZ', name: 'Beta' };

const UPDATED = `${E2E_DAY_KEY}T08:00:00.000Z`;

const ISSUES: FakeJiraIssue[] = [
  { id: E2E_ISSUE_ID, key: E2E_ISSUE_KEY, summary: 'User management', issueType: 'Task', updated: UPDATED },
  { id: '10400', key: 'XYZ-4200', summary: 'The shared library', issueType: 'Task', updated: UPDATED },
];

const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const focus = (minutes: number, appId: string, title: string): CollectedEvent => ({
  at: at(minutes),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const session = (minutes: number): CollectedEvent => ({
  at: at(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-sdk',
  cwd: SDK,
  gitBranch: 'next',
  title: 'Widen the picker',
});

/**
 * Half an hour in the checkout the branch names, then half an hour in a music player, with an agent
 * running in the shared library throughout. Spotify holds the presence the agent's band needs without
 * taking a band of its own: it is a shipped no-work-context application.
 */
const day = (): CollectedEvent[] => [
  { at: at(0), source: 'git', kind: 'git-checkout', repoPath: FUT, branch: E2E_ISSUE_BRANCH },
  ...[0, 15, 30].map((minutes) => focus(minutes, 'code', 'invite.ts - fut-frontend - Visual Studio Code')),
  ...[30, 45, 60].map((minutes) => focus(minutes, 'spotify', 'Spotify')),
  ...Array.from({ length: 13 }, (_, step) => session(step * 5)),
  { at: at(60), source: 'idle', kind: 'idle-start' },
];

const world = (backgroundProjects: string[]) => ({
  now: E2E_NOW,
  events: day(),
  git: { extraRepos: [SDK] },
  jira: { issues: ISSUES, projects: [ABC, XYZ] },
  settings: {
    ...defaultSettings(),
    favoriteProjects: [ABC, XYZ],
    backgroundProjects,
    attributionRules: [
      {
        id: 'rule-sdk',
        repoPath: SDK,
        target: { kind: 'issue' as const, issueKey: 'XYZ-4200' },
        author: 'user' as const,
        createdAt: new Date(0),
      },
    ],
  },
});

test.describe('a band of a project the user marked as background', () => {
  test('keeps only the time no other band claims', async ({ page }) => {
    await seedWorld(page, world(['XYZ']));
    await page.goto('/day');

    await expect(bands(page)).toHaveCount(2);
    await expect(titleOf(page, 'ABC-3010')).toHaveAttribute('title', 'ABC-3010 · 30m');
    await expect(titleOf(page, 'XYZ-4200')).toHaveAttribute('title', 'XYZ-4200 · 30m');
  });

  test('claims the whole morning while nothing marks it as background', async ({ page }) => {
    await seedWorld(page, world([]));
    await page.goto('/day');

    await expect(titleOf(page, 'XYZ-4200')).toHaveAttribute('title', 'XYZ-4200 · 1h 0m');
  });

  test('says in its own lane where the minutes it lost went', async ({ page }) => {
    await seedWorld(page, world(['XYZ']));
    await page.goto('/day');

    const lane = page.locator('[data-lane]').filter({ has: page.locator('[data-kind="row"][title^="XYZ-4200"]') });
    const band = lane.locator('[data-behind]');

    await expect(band).toHaveCount(1);
    await expect(band).toHaveAttribute('title', 'XYZ-4200 · in the background · 30m');
  });

  test('draws the band it lost the minutes to over the whole lane, and no row beside it', async ({ page }) => {
    await seedWorld(page, world(['XYZ']));
    await page.goto('/day');

    const lane = page.locator('[data-lane]').filter({ has: page.locator('[data-kind="row"][title^="XYZ-4200"]') });
    const laneBox = await lane.boundingBox();
    const bandBox = await lane.locator('[data-behind]').boundingBox();
    const rowBox = await titleOf(page, 'XYZ-4200').boundingBox();

    // The lane draws a one-pixel left border, so a band across the whole of it is that much narrower.
    const full = (laneBox?.width ?? 0) - 2;

    expect(bandBox?.width ?? 0).toBeGreaterThan(full);
    expect(rowBox?.width ?? 0).toBeGreaterThan(full);
  });
});

const DISCORD = 'com.hnc.Discord';
const HELPER = 'com.hnc.Discord.helper.Renderer';

/**
 * The same agent, running in the shared library all hour, with a call over the first half of it. The
 * call carries no block of its own, so it is the one foreground the cut cannot read off the day.
 */
const meetingDay = (): CollectedEvent[] => [
  { at: at(0), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Standup - Discord' },
  { at: at(0), source: 'call', kind: 'call-start', appId: HELPER },
  { at: at(30), source: 'call', kind: 'call-end', appId: HELPER },
  ...[30, 45, 60].map((minutes) => focus(minutes, 'spotify', 'Spotify')),
  ...Array.from({ length: 13 }, (_, step) => session(step * 5)),
  { at: at(60), source: 'idle', kind: 'idle-start' },
];

const meetingWorld = () => ({
  ...world(['XYZ']),
  events: meetingDay(),
  settings: {
    ...world(['XYZ']).settings,
    callRules: { countsAsWork: ['Discord'], neverCountsAsWork: [] },
  },
});

test.describe('a call over a band of a background project', () => {
  test('wins the minutes, and the band says it is behind the day for them', async ({ page }) => {
    await seedWorld(page, meetingWorld());
    await page.goto('/day');

    const lane = page.locator('[data-lane]').filter({ has: page.locator('[data-kind="row"][title^="XYZ-4200"]') });

    await expect(titleOf(page, 'XYZ-4200')).toHaveAttribute('title', 'XYZ-4200 · 30m');
    await expect(lane.locator('[data-behind]')).toHaveAttribute('title', 'XYZ-4200 · in the background · 30m');
  });
});

const bands = (page: import('@playwright/test').Page) => page.locator('[data-lane] [data-kind="row"]');

const titleOf = (page: import('@playwright/test').Page, key: string) =>
  page.locator(`[data-lane] [data-kind="row"][title^="${key}"]`);
