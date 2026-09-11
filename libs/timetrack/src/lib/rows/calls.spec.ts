import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';
import { CallMatch, dropCallWindows, matchCalls, meetingBehindRow } from './calls';
import { CALL_LANE_KEY, MEETING_LANE_KEY } from './lane';
import { MeetingOptions } from './meetings';
import { RecurringPattern } from '../model/recurrence';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const call = (overrides: Partial<CallWindow> = {}): CallWindow => ({
  from: at(10),
  to: at(11),
  appId: 'com.hnc.Discord',
  title: '#standup | Braune Digital',
  attendedMs: 30 * 60_000,
  countsAsWork: true,
  ...overrides,
});

const block = (options: { from: Date; to: Date }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: { appId: 'code' },
  evidence: [],
});

const occurrence = (overrides: Partial<CalendarOccurrenceEvent> = {}): CalendarOccurrenceEvent => ({
  at: at(10),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: 'occ-standup',
  recurringEventId: 'series-standup',
  until: at(11),
  title: 'Daily Standup',
  accepted: true,
  ...overrides,
});

const match = (options: {
  calls?: CallWindow[];
  blocks?: ActivityBlock[];
  claimed?: TimeWindow[];
  occurrences?: CalendarOccurrenceEvent[];
  meetings?: MeetingOptions;
}): CallMatch[] =>
  matchCalls({
    calls: options.calls ?? [call()],
    blocks: options.blocks ?? [],
    claimed: options.claimed ?? [],
    occurrences: options.occurrences,
    meetings: options.meetings,
  });

const PATTERNS: RecurringPattern[] = [
  { issueKey: 'ABC-9', weekday: at(10).getDay(), fromMinute: 9 * 60, toMinute: 11 * 60, occurrences: 5 },
];

describe('matchCalls', () => {
  it('proposes one row for a call a rule counted as work', () => {
    const [found] = match({});

    expect(found?.group.from).toEqual(at(10));
    expect(found?.group.to).toEqual(at(11));
    expect(found?.group.observedMs).toBe(60 * 60_000);
  });

  it('draws every call in the call lane, whatever application held it', () => {
    const [found] = match({});

    expect(found?.group.laneKey).toBe(CALL_LANE_KEY);
  });

  it('proposes nothing for an unclassified call', () => {
    expect(match({ calls: [call({ countsAsWork: false })] })).toEqual([]);
  });

  it('never proposes better than weak, however well the call is named', () => {
    const [found] = match({ meetings: { defaultIssueKey: 'ABC-1', patterns: PATTERNS } });

    expect(found?.group.confidence).toBe('weak');
  });

  it('never lands a call on the meetings issue, which says nothing about which call it was', () => {
    const [found] = match({ meetings: { defaultIssueKey: 'ABC-1' } });

    expect(found?.group.issueKey).toBeUndefined();
  });

  it('names a call from a standing commitment in Tempo history', () => {
    const [found] = match({ meetings: { defaultIssueKey: 'ABC-1', patterns: PATTERNS } });

    expect(found?.group.issueKey).toBe('ABC-9');
    expect(found?.group.evidence.map((entry) => entry.kind)).toEqual(['call', 'tempo-history']);
  });

  it('leaves a call nothing names unattributed rather than guessing a ticket', () => {
    const [found] = match({});

    expect(found?.group.issueKey).toBeUndefined();
  });

  it('names the row from the window that was in front when the call opened', () => {
    const [found] = match({});

    expect(found?.group.evidence[0]).toMatchObject({
      kind: 'call',
      detail: 'call in _#standup | Braune Digital_ 10:00-11:00, which a rule counts as work',
      summary: '#standup | Braune Digital',
    });
  });

  it('names the row from the process when the call had no window title', () => {
    const [found] = match({ calls: [call({ title: '' })] });

    expect(found?.group.evidence[0]?.summary).toBe('com.hnc.Discord');
  });

  it('reports the activity the call and the reconstruction both claim', () => {
    const [found] = match({ blocks: [block({ from: at(10, 30), to: at(10, 45) })] });

    expect(found?.overlapMs).toBe(15 * 60_000);
  });

  it('proposes no row over a meeting the calendar already claims', () => {
    expect(match({ claimed: [{ from: at(10), to: at(11) }] })).toEqual([]);
  });

  it('proposes only the part of a call the day does not already claim', () => {
    const found = match({
      calls: [call({ from: at(9, 30), to: at(11, 30) })],
      claimed: [{ from: at(10), to: at(11) }],
    });

    expect(found.map((entry) => [entry.group.from, entry.group.to])).toEqual([
      [at(9, 30), at(10)],
      [at(11), at(11, 30)],
    ]);
  });

  it('drops the scrap either side of a meeting the microphone opened early and closed late', () => {
    const found = match({
      calls: [call({ from: at(9, 58), to: at(11, 3) })],
      claimed: [{ from: at(10), to: at(11) }],
    });

    expect(found).toEqual([]);
  });

  it('orders the rows by start, whatever order the calls arrive in', () => {
    const found = match({
      calls: [call({ from: at(14), to: at(15) }), call({ from: at(10), to: at(11) })],
    });

    expect(found.map((entry) => entry.group.from)).toEqual([at(10), at(14)]);
  });
});

describe('dropCallWindows', () => {
  const app = (options: { from: Date; to: Date; appId: string; repoPath?: string }): ActivityBlock => ({
    from: options.from,
    to: options.to,
    context: { appId: options.appId, ...(options.repoPath ? { repoPath: options.repoPath } : {}) },
    evidence: [],
  });

  it('cuts the application the call is held in out of the blocks', () => {
    const found = dropCallWindows({
      blocks: [app({ from: at(10, 30), to: at(10, 50), appId: 'com.hnc.Discord' })],
      calls: [call()],
    });

    expect(found).toEqual([]);
  });

  it('keeps the part of the window that fell outside the call', () => {
    const found = dropCallWindows({
      blocks: [app({ from: at(9, 50), to: at(10, 30), appId: 'com.hnc.Discord' })],
      calls: [call()],
    });

    expect(found.map((block) => [block.from, block.to])).toEqual([[at(9, 50), at(10)]]);
  });

  it('keeps every other application, so work done while listening still counts', () => {
    const blocks = [
      app({ from: at(10, 5), to: at(10, 40), appId: 'code', repoPath: '/home/tom/dev/sdk' }),
      app({ from: at(10, 40), to: at(10, 50), appId: 'firefox' }),
    ];

    expect(dropCallWindows({ blocks, calls: [call()] })).toEqual(blocks);
  });

  it('keeps a checkout named in the call application, because other evidence named it', () => {
    const blocks = [app({ from: at(10, 5), to: at(10, 40), appId: 'com.hnc.Discord', repoPath: '/home/tom/dev/sdk' })];

    expect(dropCallWindows({ blocks, calls: [call()] })).toEqual(blocks);
  });

  it('cuts nothing for a call no rule counted as work', () => {
    const blocks = [app({ from: at(10, 30), to: at(10, 50), appId: 'com.hnc.Discord' })];

    expect(dropCallWindows({ blocks, calls: [call({ countsAsWork: false })] })).toEqual(blocks);
  });
});

describe('meetingBehindRow', () => {
  const row = (overrides: { from?: Date; to?: Date; laneKey?: string } = {}) => ({
    from: at(10),
    to: at(11),
    laneKey: MEETING_LANE_KEY,
    ...overrides,
  });

  it('names the occurrence the row was built from', () => {
    const calls = match({ occurrences: [occurrence()] });

    expect(meetingBehindRow({ row: row(), calls })?.occurrenceId).toBe('occ-standup');
  });

  it('names nothing for a row outside the meeting lane', () => {
    const calls = match({ occurrences: [occurrence()] });

    expect(meetingBehindRow({ row: row({ laneKey: CALL_LANE_KEY }), calls })).toBeUndefined();
  });

  it('names nothing for a call the calendar could not name', () => {
    expect(meetingBehindRow({ row: row(), calls: match({}) })).toBeUndefined();
  });

  it('names nothing for a row no meeting call shares time with', () => {
    const calls = match({ occurrences: [occurrence()] });

    expect(meetingBehindRow({ row: row({ from: at(14), to: at(15) }), calls })).toBeUndefined();
  });

  it('picks the meeting the row shares the most time with', () => {
    const calls = [
      ...match({
        calls: [call({ from: at(10), to: at(11), appId: 'com.hnc.Discord' })],
        occurrences: [occurrence()],
      }),
      ...match({
        calls: [call({ from: at(11), to: at(12), appId: 'com.hnc.Discord' })],
        occurrences: [occurrence({ at: at(11), until: at(12), occurrenceId: 'occ-refinement' })],
      }),
    ];

    expect(meetingBehindRow({ row: row({ from: at(10, 50), to: at(12) }), calls })?.occurrenceId).toBe(
      'occ-refinement',
    );
  });
});
