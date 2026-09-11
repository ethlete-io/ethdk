import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { MeetingNaming } from '../model/meeting-naming';
import { WorklogProposal } from '../model/proposal';
import { ClosedTimerRun } from '../model/timer';
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

const calendar = (options: {
  minute: number;
  minutes: number;
  title: string;
  accepted?: boolean;
  recurringEventId?: string;
  conferenceUrl?: string;
}): CollectedEvent => ({
  at: AT(options.minute),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: `occ-${options.minute}-${options.title}`,
  ...(options.recurringEventId ? { recurringEventId: options.recurringEventId } : {}),
  until: AT(options.minute + options.minutes),
  title: options.title,
  accepted: options.accepted ?? true,
  conferenceUrl: options.conferenceUrl ?? 'https://meet.google.com/abc-defg-hij',
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
const call = (minute: number, kind: 'call-start' | 'call-end', appId = 'firefox'): CollectedEvent => ({
  at: AT(minute),
  source: 'call',
  kind,
  appId,
});

const MEETING_DAY: CollectedEvent[] = [
  checkout(0, BRANCH),
  ...focusRun({ from: 0, to: 60, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
  calendar({ minute: 60, minutes: 30, title: 'Sprint planning' }),
  ...focusRun({ from: 61, to: 90, appId: 'firefox', title: 'Sprint planning - Google Meet' }),
  ...focusRun({ from: 91, to: 140, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
];

/** The same day with the microphone open over the meeting, which is what makes it a row at all. */
const ATTENDED_MEETING_DAY: CollectedEvent[] = [...MEETING_DAY, call(60, 'call-start'), call(90, 'call-end')];

const RUNS: ClosedTimerRun[] = [{ id: 'run-1', from: AT(215), to: AT(245), issueKey: 'FIP-2200', note: 'whiteboard' }];

const READ_THROUGH = AT(260);

const optionsFor = (events: readonly CollectedEvent[]) => ({
  config: FIP,
  timerRuns: RUNS,
  pauses: pauseWindows({ events, window: { from: AT(0), to: AT(600) }, through: READ_THROUGH }),
});

const rowsOf = (
  events: CollectedEvent[],
  options: {
    workApps?: readonly string[];
    callRules?: readonly string[];
    namings?: readonly MeetingNaming[];
  } = {},
) =>
  streamDay({
    events,
    options: {
      repoRoots: [REPO],
      windowsSeenThroughMs: READ_THROUGH.getTime(),
      callRules: { countsAsWork: [...(options.callRules ?? [])], neverCountsAsWork: [] },
      rows: {
        ...optionsFor(events),
        noWorkContext: { workApps: options.workApps },
        ...(options.namings ? { meetings: { namings: options.namings } } : {}),
      },
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
    const named = rowsOf(QUIET_DAY, { workApps: ['firefox'] });

    expect(named.unattributed.map((group) => group.observedMs)).toEqual([44 * MINUTE]);
    expect(named.unnamed.map((row) => row.observedMs)).toEqual([44 * MINUTE]);
  });
});

describe('the rows a day with a meeting produces', () => {
  const rows = rowsOf(MEETING_DAY);

  it('proposes no row for a meeting the microphone never heard, and asks about it instead', () => {
    expect(rows.unobserved.map((entry) => entry.event.title)).toEqual(['Sprint planning']);
    expect(rows.calls).toEqual([]);
    expect(rows.unnamed).toEqual([]);
  });

  it('reads the meeting off the calendar once a call was heard over it', () => {
    const attended = rowsOf(ATTENDED_MEETING_DAY, { callRules: ['firefox'] });

    expect(attended.unobserved).toEqual([]);
    expect(attended.calls.map((entry) => entry.meeting?.event.title)).toEqual(['Sprint planning']);
  });

  it('gives that call a band of its own, since no setting names an issue for one', () => {
    const attended = rowsOf(ATTENDED_MEETING_DAY, { callRules: ['firefox'] });

    expect(attended.unnamed.map((row) => [row.description, row.observedMs])).toEqual([
      ['Sprint planning', 30 * MINUTE],
    ]);
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

describe('the rows a day of overlapping invitations produces', () => {
  /** An invitation never answered, with the microphone open over its hour. */
  const IGNORED_INVITATION_DAY: CollectedEvent[] = [
    checkout(0, BRANCH),
    ...focusRun({ from: 0, to: 60, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
    calendar({ minute: 60, minutes: 30, title: 'All hands', accepted: false }),
    ...focusRun({ from: 61, to: 90, appId: 'firefox', title: 'Mozilla Firefox' }),
    call(60, 'call-start'),
    call(90, 'call-end'),
  ];

  /** Two invitations the user accepted, both running over the one call the microphone heard. */
  const DOUBLE_BOOKED_DAY: CollectedEvent[] = [
    checkout(0, BRANCH),
    ...focusRun({ from: 0, to: 60, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
    calendar({ minute: 60, minutes: 30, title: 'Sprint planning' }),
    calendar({
      minute: 60,
      minutes: 30,
      title: 'Design review',
      conferenceUrl: 'https://meet.google.com/klm-nopq-rst',
    }),
    ...focusRun({ from: 61, to: 90, appId: 'firefox', title: 'Mozilla Firefox' }),
    call(60, 'call-start'),
    call(90, 'call-end'),
  ];

  /** The same two invitations, with the browser naming one of them for the whole call. */
  const DECIDED_DAY: CollectedEvent[] = [
    checkout(0, BRANCH),
    ...focusRun({ from: 0, to: 60, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
    calendar({ minute: 60, minutes: 30, title: 'Sprint planning' }),
    calendar({
      minute: 60,
      minutes: 30,
      title: 'Design review',
      conferenceUrl: 'https://meet.google.com/klm-nopq-rst',
    }),
    ...focusRun({ from: 61, to: 90, appId: 'firefox', title: 'Design review - Google Meet' }),
    call(60, 'call-start'),
    call(90, 'call-end'),
  ];

  it('names the call from an invitation the user never answered, when no title decides', () => {
    const rows = rowsOf(IGNORED_INVITATION_DAY, { callRules: ['firefox'] });

    expect(rows.calls.map((entry) => entry.meeting?.event.title)).toEqual([undefined]);
    expect(rows.calls.map((entry) => entry.candidates.map((candidate) => candidate.event.title))).toEqual([
      ['All hands'],
    ]);
  });

  it('asks about neither invitation, because a call was heard over both', () => {
    const rows = rowsOf(DOUBLE_BOOKED_DAY, { callRules: ['firefox'] });

    expect(rows.unobserved).toEqual([]);
  });

  it('picks neither of two accepted meetings over one call, and lists both as candidates', () => {
    const rows = rowsOf(DOUBLE_BOOKED_DAY, { callRules: ['firefox'] });

    expect(rows.calls.map((entry) => entry.meeting)).toEqual([undefined]);
    expect(rows.calls.map((entry) => entry.candidates.map((candidate) => candidate.event.title).sort())).toEqual([
      ['Design review', 'Sprint planning'],
    ]);
  });

  it('picks the meeting a window title named, however many were accepted', () => {
    const rows = rowsOf(DECIDED_DAY, { callRules: ['firefox'] });

    expect(rows.calls.map((entry) => entry.meeting?.event.title)).toEqual(['Design review']);
    expect(rows.calls.map((entry) => entry.meeting?.match)).toEqual(['certain']);
  });
});

describe('the rows a remembered naming produces', () => {
  const SERIES = 'series-sprint-planning';

  const namingFor = (issueKey: string): MeetingNaming[] => [
    { seriesKey: SERIES, issueKey, title: 'Sprint planning', createdAt: AT(-1440) },
  ];

  const dayOf = (minute: number): CollectedEvent[] => [
    checkout(0, BRANCH),
    ...focusRun({ from: 0, to: minute, appId: 'code', title: 'pack.ts - fut-frontend - Code' }),
    calendar({ minute, minutes: 30, title: 'Sprint planning', recurringEventId: SERIES }),
    ...focusRun({ from: minute + 1, to: minute + 30, appId: 'firefox', title: 'Mozilla Firefox' }),
    call(minute, 'call-start'),
    call(minute + 30, 'call-end'),
  ];

  it('names the call from the answer the user gave for the series', () => {
    const rows = rowsOf(dayOf(60), { callRules: ['firefox'], namings: namingFor('FIP-3000') });

    expect(rows.calls.map((entry) => entry.group.issueKey)).toEqual(['FIP-3000']);
    expect(rows.unnamed).toEqual([]);
  });

  it('names a later occurrence of the same series without asking again', () => {
    const rows = rowsOf(dayOf(120), { callRules: ['firefox'], namings: namingFor('FIP-3000') });

    expect(rows.calls.map((entry) => entry.group.issueKey)).toEqual(['FIP-3000']);
  });

  it('offers the answer on an occurrence no call was heard over, without proposing a row for it', () => {
    const events = dayOf(60).filter((event) => event.source !== 'call');
    const rows = rowsOf(events, { callRules: ['firefox'], namings: namingFor('FIP-3000') });

    expect(rows.calls).toEqual([]);
    expect(rows.unobserved.map((entry) => [entry.event.title, entry.issueKey])).toEqual([
      ['Sprint planning', 'FIP-3000'],
    ]);
  });
});
