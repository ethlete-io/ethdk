import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { correlateDay } from '../correlate/correlate-day';
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
 *
 * Nothing switches application inside the stickiness window, so both block builders see the same
 * spans and the two pipelines have to agree row for row.
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

const bothWays = (events: CollectedEvent[]) => {
  const rows = optionsFor(events);

  return {
    v1: correlateDay({ ...rows, events, sessionize: { repoRoots: [REPO] } }),
    v2: streamDay({
      events,
      options: { repoRoots: [REPO], windowsSeenThroughMs: READ_THROUGH.getTime(), rows },
    }).rows,
  };
};

const bookedMsByIssue = (proposals: readonly WorklogProposal[]) => {
  const totals = new Map<string, number>();

  for (const proposal of proposals) {
    totals.set(proposal.issueKey, (totals.get(proposal.issueKey) ?? 0) + proposal.observedMs);
  }

  return [...totals].sort(([a], [b]) => a.localeCompare(b));
};

describe('the day read through both pipelines', () => {
  const { v1, v2 } = bothWays(QUIET_DAY);

  it('books the same issues for the same time', () => {
    expect(bookedMsByIssue(v2.proposals)).toEqual(bookedMsByIssue(v1.proposals));
  });

  it('reads the same run the user timed', () => {
    expect(v2.timers.map((timer) => timer.run.id)).toEqual(v1.timers.map((timer) => timer.run.id));
  });

  it('leaves the same work waiting to be named', () => {
    expect(v2.unattributed.map((group) => group.observedMs)).toEqual(v1.unattributed.map((group) => group.observedMs));
  });
});

describe('the day read through both pipelines, where the two builders disagree', () => {
  const { v1, v2 } = bothWays(MEETING_DAY);

  it('reads the same meeting off the calendar', () => {
    expect(v2.meetings.map((meeting) => meeting.event.title)).toEqual(
      v1.meetings.map((meeting) => meeting.event.title),
    );
  });

  /**
   * The drift ADR 0007 measured, in minutes. `sessionize` keeps a checkout sticky for five minutes
   * whatever takes the focus next, so the browser that opens the meeting is booked to the editor's
   * branch. `streamDay` passes the sticky only inside the application that set it, so it is not.
   */
  it('keeps the browser that opened the meeting off the editor branch', () => {
    const of = (proposals: readonly WorklogProposal[]) =>
      proposals.filter((proposal) => proposal.issueKey === 'FIP-2177').reduce((sum, row) => sum + row.observedMs, 0);

    expect(of(v1.proposals) - of(v2.proposals)).toBe(5 * MINUTE);
  });
});
