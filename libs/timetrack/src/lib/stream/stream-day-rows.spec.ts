import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { WorklogProposal } from '../model/proposal';
import { ClosedTimerRun } from '../model/timer';
import { classifyCalls } from './calls';
import { pauseWindows } from './pauses';
import { streamDay } from './stream-day';

const MINUTE = 60_000;
const DAY_START = new Date(2026, 7, 11, 8, 0, 0);
const AT = (minute: number) => new Date(DAY_START.getTime() + minute * MINUTE);
const FIP = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });
const REPO = '/home/tom/dev/fut-frontend';
const BRANCH = 'feat/FIP-2177-club-pack';

const focus = (minute: number, appId: string, title: string): CollectedEvent => ({
  at: AT(minute),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const focusRun = (options: { from: number; to: number; appId: string; title: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) =>
    focus(options.from + offset, options.appId, options.title),
  );

const checkout = (minute: number, branch: string): CollectedEvent => ({
  at: AT(minute),
  source: 'git',
  kind: 'git-checkout',
  repoPath: REPO,
  branch,
});

const commit = (minute: number, sha: string, subject: string): CollectedEvent => ({
  at: AT(minute),
  source: 'git',
  kind: 'git-commit',
  repoPath: REPO,
  branch: BRANCH,
  sha,
  subject,
});

const pause = (minute: number, kind: 'pause-start' | 'pause-end'): CollectedEvent => ({
  at: AT(minute),
  source: 'idle',
  kind,
});

const calendar = (options: { minute: number; minutes: number; title: string }): CollectedEvent => ({
  at: AT(options.minute),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: `occ-${options.minute}`,
  until: AT(options.minute + options.minutes),
  title: options.title,
  accepted: true,
  conferenceUrl: 'https://meet.google.com/abc-defg-hij',
});

/**
 * A day shaped like a real one: a checkout whose branch names the issue, a stretch of browsing that
 * names nothing, a run the user timed and a pause they took.
 */
const QUIET_DAY: CollectedEvent[] = [
  checkout(0, BRANCH),
  ...focusRun({ from: 0, to: 60, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
  commit(58, 'abc1234', 'feat(pack): Draw the club pack'),
  pause(60, 'pause-start'),
  pause(90, 'pause-end'),
  ...focusRun({ from: 90, to: 140, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
  ...focusRun({ from: 146, to: 190, appId: 'firefox', title: 'Angular signals guide' }),
];

/** The same day, with a meeting the calendar knew about opening a browser right after the editor. */
const MEETING_DAY: CollectedEvent[] = [
  checkout(0, BRANCH),
  ...focusRun({ from: 0, to: 60, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
  calendar({ minute: 60, minutes: 30, title: 'Sprint planning' }),
  ...focusRun({ from: 61, to: 90, appId: 'firefox', title: 'Sprint planning - Google Meet' }),
  ...focusRun({ from: 91, to: 140, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
];

const RUNS: ClosedTimerRun[] = [{ id: 'run-1', from: AT(215), to: AT(245), issueKey: 'FIP-2200', note: 'whiteboard' }];

const READ_THROUGH = AT(260);

const optionsFor = (events: readonly CollectedEvent[]) => ({
  config: FIP,
  timerRuns: RUNS,
  pauses: pauseWindows({ events, window: { from: AT(0), to: AT(600) }, through: READ_THROUGH }),
  calls: classifyCalls({ events, rules: { countsAsWork: [], neverCountsAsWork: [] }, until: READ_THROUGH }),
});

const rowsOf = (events: CollectedEvent[], workApps?: readonly string[]) =>
  streamDay({
    events,
    options: {
      repoRoots: [REPO],
      windowsSeenThroughMs: READ_THROUGH.getTime(),
      rows: { ...optionsFor(events), noWorkContext: { workApps } },
    },
  }).rows;

const bookedMsByIssue = (proposals: readonly WorklogProposal[]) => {
  const totals = new Map<string, number>();

  for (const proposal of proposals) {
    totals.set(proposal.issueKey, (totals.get(proposal.issueKey) ?? 0) + proposal.observedMs);
  }

  return [...totals].sort(([a], [b]) => a.localeCompare(b));
};

describe('the rows a quiet day produces', () => {
  const rows = rowsOf(QUIET_DAY);

  it('books the branch that names the issue, and the run the user timed', () => {
    expect(bookedMsByIssue(rows.proposals)).toEqual([
      ['FIP-2177', 116 * MINUTE],
      ['FIP-2200', 30 * MINUTE],
    ]);
  });

  it('reads the run the user timed', () => {
    expect(rows.timers.map((timer) => timer.run.id)).toEqual(['run-1']);
  });

  it('drops the browsing, since no rule says the browser holds work', () => {
    expect(rows.unattributed).toEqual([]);
    expect(rows.unnamed).toEqual([]);
  });

  it('leaves that browsing waiting as one band once a rule says the browser holds work', () => {
    const named = rowsOf(QUIET_DAY, ['firefox']);

    expect(named.unattributed.map((group) => group.observedMs)).toEqual([44 * MINUTE]);
    expect(named.unnamed.map((row) => row.observedMs)).toEqual([44 * MINUTE]);
  });
});

describe('the rows a day with a meeting produces', () => {
  const rows = rowsOf(MEETING_DAY);

  it('reads the meeting off the calendar', () => {
    expect(rows.meetings.map((meeting) => meeting.event.title)).toEqual(['Sprint planning']);
  });

  it('gives the meeting a band of its own, since no setting names an issue for one', () => {
    expect(rows.unnamed.map((row) => [row.description, row.observedMs])).toEqual([['Sprint planning', 30 * MINUTE]]);
  });

  /**
   * What ADR 0007 measured, stated as the rule rather than as a difference: the sticky checkout is
   * passed only inside the application that set it, so the browser that opens a meeting takes none
   * of the editor's branch with it. `sessionize` booked it five minutes of FIP-2177.
   */
  it('keeps the browser that opened the meeting off the editor branch', () => {
    expect(bookedMsByIssue(rows.proposals)).toEqual([
      ['FIP-2177', 110 * MINUTE],
      ['FIP-2200', 30 * MINUTE],
    ]);
  });
});
