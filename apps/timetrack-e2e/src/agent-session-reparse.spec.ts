import { CollectedEvent, TimetrackSettings, shiftDayKey } from '@ethlete/timetrack';
import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_DAY_KEY, E2E_NOW, askAgent, expect, readStoredCursors, seedWorld, test } from './support';
import { Page } from '@playwright/test';

const SESSION = 'session-click';
const YESTERDAY = shiftDayKey(E2E_DAY_KEY, -1);

const on = (day: string, clock: string) => new Date(`${day}T${clock}:00.000Z`);

const turn = (day: string, clock: string) =>
  JSON.stringify({
    type: 'assistant',
    uuid: `msg-${clock}`,
    timestamp: on(day, clock).toISOString(),
    cwd: E2E_REPO,
    sessionId: SESSION,
    gitBranch: 'main',
  });

const CLOCKS = ['09:00', '09:05', '09:10', '09:15'];

const logLines = (day: string) => [
  JSON.stringify({ type: 'ai-title', sessionId: SESSION, aiTitle: '(click)=' }),
  ...CLOCKS.map((clock) => turn(day, clock)),
];

/** What the parse rules before 2026-10-09 stored from the log: every sample titled after the note. */
const storedSample = (day: string, clock: string): CollectedEvent => ({
  at: on(day, clock),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: SESSION,
  cwd: E2E_REPO,
  gitBranch: 'main',
  workedIn: E2E_REPO,
  title: '(click)=',
});

const settings = (): TimetrackSettings => ({
  ...defaultSettings(),
  projectLinks: [
    { id: 'link-fut', path: E2E_REPO, target: { kind: 'project', projectKey: 'ABC' }, createdAt: new Date(0) },
  ],
});

const seed = (page: Page, options: { day: string; booked?: boolean }) => {
  const { day } = options;
  const lines = logLines(day);

  return seedWorld(page, {
    now: E2E_NOW,
    settings: settings(),
    events: CLOCKS.map((clock) => storedSample(day, clock)),
    agentLogs: [
      {
        id: SESSION,
        path: `/Users/e2e/.claude/projects/-Users-e2e-dev-fut-frontend/${SESSION}.jsonl`,
        modifiedAt: `${day}T09:16:00.000Z`,
        lines,
      },
    ],
    agentLogCursors: {
      'agent-session': [
        {
          id: SESSION,
          nextLine: lines.length,
          after: on(day, '09:15').toISOString(),
          title: '(click)=',
          cwd: E2E_REPO,
        },
      ],
    },
    ...(options.booked
      ? {
          ledger: [
            { proposalId: 'booked-row', day, tempoWorklogId: '501', contentHash: 'hash', syncedAt: on(day, '17:00') },
          ],
        }
      : {}),
  });
};

const storedTitles = async (page: Page, day: string) => {
  const answer = await askAgent<{ events: CollectedEvent[] }>(page, { op: 'day.events', day });

  return answer.ok
    ? answer.value.events.flatMap((event) => (event.kind === 'agent-session' ? [event.title ?? null] : []))
    : [];
};

const reparsed = async (page: Page) =>
  expect.poll(async () => (await readStoredCursors(page))['agent-session']?.[0]?.parserVersion ?? 0).toBeGreaterThan(1);

/**
 * A change to the agent-log parse rules reaches the logs already read on its own: the collector reads
 * them again from the top and replaces what the store holds, except on a finished day this app booked.
 */
test.describe('agent session logs read under older parse rules', () => {
  test('are read again without anyone asking, and the note that does not read as words leaves the day', async ({
    page,
  }) => {
    await seed(page, { day: E2E_DAY_KEY });
    await page.goto('/day');

    await reparsed(page);
    await expect.poll(() => storedTitles(page, E2E_DAY_KEY)).not.toContain('(click)=');
    await expect(page.locator('ethlete-day-review')).not.toContainText('(click)=');
  });

  test('are read again on today even after part of it was booked', async ({ page }) => {
    await seed(page, { day: E2E_DAY_KEY, booked: true });
    await page.goto('/day');

    await reparsed(page);
    await expect.poll(() => storedTitles(page, E2E_DAY_KEY)).not.toContain('(click)=');
  });

  test('leave a finished day this app booked as it was booked', async ({ page }) => {
    await seed(page, { day: YESTERDAY, booked: true });
    await page.goto('/day');

    await reparsed(page);
    expect(await storedTitles(page, YESTERDAY)).toEqual(['(click)=', '(click)=', '(click)=', '(click)=']);
  });
});
