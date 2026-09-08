import { CollectedEvent } from '@ethlete/timetrack';
import { E2E_DAY_KEY, E2E_NOW, expect, seedWorld, test } from './support';

/** The checkout the fake git backend discovers, so its subdirectories fold into it. */
const FUT = '/Users/e2e/dev/fut-frontend';

/** A second checkout no root covers. An agent ran in it and no window ever showed it. */
const SDK = '/Users/e2e/dev/ethlete-sdk';

/** Nine in the morning on the seeded day. The browser is pinned to UTC, so this is 09:00 on screen. */
const at = (minutes: number) => new Date(new Date(`${E2E_DAY_KEY}T09:00:00.000Z`).getTime() + minutes * 60_000);

const focus = (minutes: number, appId: string, title: string): CollectedEvent => ({
  at: at(minutes),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const editing = (minutes: number) => focus(minutes, 'code', 'invite.ts - fut-frontend - Visual Studio Code');

const session = (minutes: number): CollectedEvent => ({
  at: at(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-sdk',
  cwd: SDK,
  gitBranch: 'next',
  title: 'Read a day as streams',
});

/**
 * One two-hour morning that ran three streams: an editor in one checkout, an agent in another that
 * nothing ever focused, and half an hour in Slack. It is the shape slice 1 exists to report — the
 * numbers each line must show are worked out in the test below.
 */
const day = (): CollectedEvent[] => [
  { at: at(0), source: 'git', kind: 'git-checkout', repoPath: FUT, branch: 'next' },
  ...[0, 15, 30, 45, 90, 105, 120].map(editing),
  ...[60, 75].map((minutes) => focus(minutes, 'slack', 'Slack')),
  ...Array.from({ length: 13 }, (_, step) => session(32 + step * 5)),
  {
    at: at(60),
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: 'claude-code',
    sessionId: 'session-sdk',
    turnId: 'turn-1',
    cwd: SDK,
    model: 'claude-opus-5',
    usage: { input: 12_000, output: 1_200_000, cacheWrite: 40_000, cacheRead: 604_000_000, thinking: 30_000 },
  },
];

const stream = (page: Parameters<typeof seedWorld>[0], key: string) => page.locator(`[data-stream="${key}"]`);

test.describe('the today view', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: day() });
    await page.goto('/today');
  });

  test('reports presence, engaged time and the ratio between them', async ({ page }) => {
    const totals = page.locator('[data-totals]');

    // The morning was two hours at the machine. The editor held 90 minutes of it and Slack 30, and
    // the agent's hour ran alongside — so the day was engaged for three hours in two.
    await expect(totals).toContainText('2h 0m present');
    await expect(totals).toContainText('3h 0m engaged');
    await expect(totals).toContainText('1.5× at once');
  });

  test('shows one line per checkout, ordered by when it started', async ({ page }) => {
    await expect(page.locator('[data-stream] [data-label]')).toHaveText([
      'fut-frontend',
      'ethlete-sdk',
      'Other applications',
    ]);
  });

  test('gives the focused window its checkout, and the rest to one folded line', async ({ page }) => {
    await expect(stream(page, `repo:${FUT}`).locator('[data-engaged]')).toHaveText('1h 30m engaged');
    await expect(stream(page, 'other-applications').locator('[data-engaged]')).toHaveText('30m engaged');
    await expect(stream(page, 'other-applications')).toContainText('Slack');
  });

  test('books a checkout an agent ran in, and says nobody ever looked at it', async ({ page }) => {
    const agentOnly = stream(page, `repo:${SDK}`);

    await expect(agentOnly.locator('[data-engaged]')).toHaveText('1h 0m engaged');
    await expect(agentOnly.locator('[data-never-focused]')).toHaveText('agent only, never focused');
    await expect(agentOnly).toContainText('Read a day as streams');
  });

  test('shows what the turns spent, in the classes they are priced in', async ({ page }) => {
    await expect(stream(page, `repo:${SDK}`).locator('[data-spend]')).toHaveText('1 turn · 1.2 M out · 604 M cached');
  });

  test('names the spend no line books, so the day reconciles', async ({ page }) => {
    // Two hours after the last sample, so the machine had long gone idle. Nothing is present, so no
    // block covers it and no stream can take it.
    await seedWorld(page, {
      now: E2E_NOW,
      events: [
        ...day(),
        {
          at: at(240),
          source: 'agent-usage',
          kind: 'agent-usage',
          provider: 'claude-code',
          sessionId: 'session-sdk',
          turnId: 'turn-away',
          cwd: SDK,
          model: 'claude-opus-5',
          usage: { input: 500, output: 800_000, cacheWrite: 0, cacheRead: 90_000_000, thinking: 0 },
        },
      ],
    });
    await page.goto('/today');

    await expect(page.locator('[data-unattributed]')).toHaveText('1 turn · 800 k out · 90.0 M cached');
  });

  test('shows no unbooked line for a day every turn belongs to a stream', async ({ page }) => {
    await expect(page.locator('[data-unattributed]')).toHaveCount(0);
  });

  test('says so for a day nothing observed', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [] });
    await page.goto('/today');

    await expect(page.getByText(/Nothing observed this day/)).toBeVisible();
  });
});
