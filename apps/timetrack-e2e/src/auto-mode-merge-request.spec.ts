import { CollectedEvent, TimetrackSettings } from '@ethlete/timetrack';
import { E2E_ISSUE_KEY, E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_DAY_KEY, E2E_NOW, askAgent, expect, openAutoModeReadout, seedWorld, test } from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const reading = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'orders-page.component.ts - fut-frontend - Visual Studio Code',
});

const asking = (clock: string): CollectedEvent => ({
  at: at(clock),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-hunt',
  cwd: E2E_REPO,
  gitBranch: 'main',
  workedIn: E2E_REPO,
  title: 'Find why the order transfer button came back on main',
});

/** Work beside the hunt that wrote a file, so auto mode asks about it and drafts a ticket. */
const building = (clock: string): CollectedEvent[] => [
  {
    at: at(clock),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'sidebar.component.ts - fut-frontend - Visual Studio Code',
  },
  {
    at: at(clock),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: 'session-build',
    cwd: E2E_REPO,
    gitBranch: 'feat/sidebar',
    workedIn: `${E2E_REPO}/src/sidebar.component.ts`,
    title: 'Build the collapsible sidebar',
  },
];

const commented = (description?: string): CollectedEvent => ({
  at: at('10:21'),
  source: 'gitlab',
  kind: 'merge-request-activity',
  eventId: 'note-1095',
  action: 'commented on',
  projectPath: 'group/fut-frontend',
  mergeRequestIid: '1095',
  branch: 'feature/disable-game-code-transfer-main',
  title: 'fix(hub): Restore game code order downloads on main',
  ...(description ? { description } : {}),
});

const seed = (page: Page, mergeRequest: CollectedEvent) =>
  seedWorld(page, {
    now: E2E_NOW,
    settings: {
      ...defaultSettings(),
      reasoning: { ...defaultSettings().reasoning, autoMode: true },
    } as TimetrackSettings,
    events: [
      { at: at('09:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: 'main' },
      ...['09:00', '09:10', '09:20', '09:30', '09:40'].map(reading),
      ...['09:05', '09:15', '09:25', '09:35'].map(asking),
      { at: at('11:00'), source: 'git', kind: 'git-checkout', repoPath: E2E_REPO, branch: 'feat/sidebar' },
      ...['11:00', '11:05', '11:10', '11:15'].flatMap(building),
      mergeRequest,
    ],
  });

type DayRows = { rows: { issueKey?: string; sources: { issue: string } }[] };

const autoNamed = async (page: Page) => {
  const answer = await askAgent<DayRows>(page, { op: 'day.rows', day: E2E_DAY_KEY });

  return answer.ok ? answer.value.rows.flatMap((row) => (row.sources.issue === 'auto' ? [row.issueKey] : [])) : [];
};

type Waiting = { op: string; summary: string }[];

const waiting = async (page: Page) => {
  const answer = await askAgent<Waiting>(page, { op: 'approvals.list' });

  return answer.ok ? answer.value : [];
};

const creates = async (page: Page) =>
  (await waiting(page)).flatMap((item) => (item.op === 'jira.create' ? [item.summary] : []));

/** Waits for the ticket call about the sidebar work, and answers whether one was made about the hunt. */
const askedTheModelAboutTheHunt = async (page: Page) => {
  const calls = (await openAutoModeReadout(page)).locator('[data-model-call]').filter({ hasText: '"parents"' });

  await expect(calls.filter({ hasText: 'collapsible sidebar' })).not.toHaveCount(0);

  return (await calls.filter({ hasText: 'order transfer' }).count()) > 0;
};

/**
 * A bug hunt: an agent session that read and answered and wrote no file, with nothing committed, on a
 * day the user commented on a merge request of the same checkout. The sidebar work beside it is asked
 * after the hunt, as the shorter stretch, so its model call says auto mode has passed the hunt.
 */
test.describe('auto mode on a stretch whose agent session changed nothing', () => {
  test('names it with the issue of the merge request the user was active on, and drafts no ticket', async ({
    page,
  }) => {
    await seed(page, commented(`Brings the downloads back, see ${E2E_ISSUE_KEY}.`));
    await page.goto('/day');

    await expect.poll(() => autoNamed(page)).toContain(E2E_ISSUE_KEY);
    await expect.poll(() => creates(page)).toEqual([expect.stringContaining('feat/sidebar')]);
    expect(await askedTheModelAboutTheHunt(page)).toBe(false);
  });

  test('leaves it unnamed where the merge request names no issue', async ({ page }) => {
    await seed(page, commented());
    await page.goto('/day');

    expect(await askedTheModelAboutTheHunt(page)).toBe(false);
    expect(await waiting(page)).toEqual([
      expect.objectContaining({ summary: expect.stringContaining('feat/sidebar') }),
    ]);
    expect(await autoNamed(page)).toEqual([]);
  });
});
