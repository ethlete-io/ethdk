import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CallWindow, callLabel } from '../model/call';
import { CalendarOccurrenceEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';
import { CallNaming, callFeaturesOf } from '../model/call-naming';
import { MeetingNaming } from '../model/meeting-naming';
import { CallMatch, callBehindRow, dropCallWindows, matchCalls, meetingBehindRow } from './calls';
import { describeWork } from './describe';
import { CALL_LANE_KEY } from './lane';
import { MeetingOptions } from './meetings';
import { RecurringPattern } from '../model/recurrence';
import { classifyCalls } from '../stream/calls';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const call = (overrides: Partial<CallWindow> = {}): CallWindow => ({
  from: at(10),
  to: at(11),
  appId: 'com.hnc.Discord',
  title: '#standup | Braune Digital',
  attendedMs: 30 * 60_000,
  countsAsWork: true,
  isPresence: true,
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

  it('draws a call a rule excluded as a band that books nothing', () => {
    const [found] = match({ calls: [call({ countsAsWork: false })] });

    expect(found?.group.laneKey).toBe(CALL_LANE_KEY);
    expect(found?.group.bookable).toBe(false);
    expect(found?.group.observedMs).toBe(60 * 60_000);
    expect(found?.group.evidence[0]?.detail).toBe(
      'call in _#standup | Braune Digital_ 10:00-11:00, which no rule counts as work',
    );
  });

  it('names nothing on a call a rule excluded, however well the day could name it', () => {
    const [found] = match({
      calls: [call({ countsAsWork: false })],
      occurrences: [occurrence()],
      meetings: {
        patterns: PATTERNS,
        namings: [{ seriesKey: 'series-standup', issueKey: 'ABC-1', title: 'Daily Standup', createdAt: at(9) }],
      },
    });

    expect(found?.group.issueKey).toBeUndefined();
    expect(found?.group.confidence).toBe('weak');
    expect(found?.meeting).toBeUndefined();
  });

  it('names the participants of the meeting it was matched to, once over a remembered naming', () => {
    const [found] = match({
      occurrences: [occurrence({ participants: ['Anna Müller', 'Ben Kurz', 'Cem Arslan', 'Dana Voss'] })],
      meetings: {
        namings: [{ seriesKey: 'series-standup', issueKey: 'ABC-1', title: 'Daily Standup', createdAt: at(9) }],
      },
    });

    expect(found?.group.issueKey).toBe('ABC-1');
    expect(found && describeWork({ group: found.group })).toBe(
      'Daily Standup (with Anna Müller, Ben Kurz, Cem Arslan +1)',
    );
  });

  it('counts no double proposal against a call a rule excluded', () => {
    const [found] = match({
      calls: [call({ countsAsWork: false })],
      blocks: [block({ from: at(10), to: at(11) })],
    });

    expect(found?.overlapMs).toBe(0);
  });

  it('never proposes better than weak, however well the call is named', () => {
    const [found] = match({ meetings: { patterns: PATTERNS } });

    expect(found?.group.confidence).toBe('weak');
  });

  it('never lands a call on the meetings issue, which says nothing about which call it was', () => {
    const [found] = match({ meetings: {} });

    expect(found?.group.issueKey).toBeUndefined();
  });

  it('names a call from a standing commitment in Tempo history', () => {
    const [found] = match({ meetings: { patterns: PATTERNS } });

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

describe('a call that ran through several meetings', () => {
  const reward = occurrence({
    at: at(8),
    until: at(9),
    occurrenceId: 'occ-reward',
    recurringEventId: 'series-reward',
    title: 'Besprechung Reward System',
  });
  const pentest = occurrence({
    at: at(9),
    until: at(9, 30),
    occurrenceId: 'occ-pentest',
    recurringEventId: 'series-pentest',
    title: 'Pentest Abstimmung',
  });
  const daily = occurrence({
    at: at(12),
    until: at(12, 30),
    occurrenceId: 'occ-daily',
    recurringEventId: 'series-daily',
    title: 'Daily / Update EA',
    accepted: false,
  });
  const discord = (to: Date) =>
    call({ from: new Date(2026, 7, 11, 8, 3, 45), to, title: 'Meeting #4 96kbps | Braune Digital - Discord' });

  it('cuts it between the meetings and keeps the overrun with the last one', () => {
    const found = match({ calls: [discord(at(9, 45))], occurrences: [reward, pentest, daily] });

    expect(found.map((entry) => [entry.group.from, entry.group.to, entry.meeting?.event.title])).toEqual([
      [new Date(2026, 7, 11, 8, 3, 45), at(9), 'Besprechung Reward System'],
      [at(9), at(9, 45), 'Pentest Abstimmung'],
    ]);
  });

  it('keeps an early start with the first meeting', () => {
    const found = match({ calls: [call({ from: at(7, 40), to: at(9, 30) })], occurrences: [reward, pentest] });

    expect(found.map((entry) => [entry.group.from, entry.group.to, entry.meeting?.event.title])).toEqual([
      [at(7, 40), at(9), 'Besprechung Reward System'],
      [at(9), at(9, 30), 'Pentest Abstimmung'],
    ]);
  });

  it('keeps a gap between two meetings a piece of its own', () => {
    const later = occurrence({
      at: at(10),
      until: at(10, 30),
      occurrenceId: 'occ-later',
      recurringEventId: 'series-later',
      title: 'Sprint Review',
    });
    const found = match({ calls: [call({ from: at(8), to: at(10, 30) })], occurrences: [reward, later] });

    expect(found.map((entry) => [entry.group.from, entry.group.to, entry.meeting?.event.title])).toEqual([
      [at(8), at(9), 'Besprechung Reward System'],
      [at(9), at(10), undefined],
      [at(10), at(10, 30), 'Sprint Review'],
    ]);
  });

  it('re-cuts the call as it keeps running', () => {
    const early = match({ calls: [discord(at(8, 40))], occurrences: [reward, pentest, daily] });
    const later = match({ calls: [discord(at(9, 20))], occurrences: [reward, pentest, daily] });

    expect(early.map((entry) => entry.meeting?.event.title)).toEqual(['Besprechung Reward System']);
    expect(later.map((entry) => entry.meeting?.event.title)).toEqual([
      'Besprechung Reward System',
      'Pentest Abstimmung',
    ]);
  });

  it('folds a scrap too short to propose a row into the piece beside it', () => {
    const found = match({ calls: [discord(at(9, 2))], occurrences: [reward, pentest] });

    expect(found.map((entry) => [entry.group.to, entry.meeting?.event.title])).toEqual([
      [at(9, 2), 'Besprechung Reward System'],
    ]);
  });

  it('keeps a call over a single meeting whole', () => {
    const found = match({ calls: [call({ from: at(9, 50), to: at(11, 20) })], occurrences: [occurrence()] });

    expect(found.map((entry) => [entry.group.from, entry.group.to, entry.meeting?.event.title])).toEqual([
      [at(9, 50), at(11, 20), 'Daily Standup'],
    ]);
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
    laneKey: CALL_LANE_KEY,
    ...overrides,
  });

  it('names the occurrence the row was built from', () => {
    const calls = match({ occurrences: [occurrence()] });

    expect(meetingBehindRow({ row: row(), calls })?.occurrenceId).toBe('occ-standup');
  });

  it('names nothing for a row outside the call lane', () => {
    const calls = match({ occurrences: [occurrence()] });

    expect(meetingBehindRow({ row: row({ laneKey: 'repo:/dev/sdk' }), calls })).toBeUndefined();
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

describe('a call the calendar never held', () => {
  const room = call({ appId: 'com.hnc.Discord', from: at(10, 30), to: at(11), title: 'Open Room #1' });
  const meeting = call({ appId: 'com.google.Chrome', from: at(9, 45), to: at(10, 15), title: 'Meet' });
  const meetingOccurrence = occurrence({
    at: at(9, 45),
    until: at(10, 15),
    title: 'Weekly',
    recurringEventId: 'weekly',
  });

  const naming = (overrides: Partial<CallNaming> = {}): CallNaming => ({
    ...callFeaturesOf({ appId: room.appId, from: room.from, to: room.to, after: 'series:weekly' }),
    target: { kind: 'issue', issueKey: 'ABC-7' },
    label: 'Open Room #1',
    createdAt: at(9),
    ...overrides,
  });

  it('names it from the answer the user gave for a call like it', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence],
      meetings: { callNamings: [naming()] },
    });

    expect(second?.group.issueKey).toBe('ABC-7');
    expect(second?.group.laneKey).toBe(CALL_LANE_KEY);
    expect(second?.group.confidence).toBe('likely');
  });

  it('carries a stand-in the answer named, and no issue key with it', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence],
      meetings: { callNamings: [naming({ target: { kind: 'stand-in', standInId: 'si-1' } })] },
    });

    expect(second?.group.standInId).toBe('si-1');
    expect(second?.group.issueKey).toBeUndefined();
    expect(second?.group.confidence).toBe('likely');
  });

  it('reads the user answer before the Tempo history', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence],
      meetings: { callNamings: [naming()], patterns: PATTERNS },
    });

    expect(second?.group.issueKey).toBe('ABC-7');
  });

  it('keys it on the meeting that ran before it, not on the clock', () => {
    const [only] = match({ calls: [room], meetings: { callNamings: [naming()] } });

    expect(only?.group.issueKey).toBeUndefined();
  });

  it('forgets the preceding call once the gap is long enough', () => {
    const late = call({ ...room, from: at(11, 45), to: at(12, 15) });
    const [, second] = match({
      calls: [meeting, late],
      occurrences: [meetingOccurrence],
      meetings: { callNamings: [naming()] },
    });

    expect(second?.group.issueKey).toBeUndefined();
  });

  const overlapping = occurrence({
    at: at(10, 30),
    until: at(11),
    title: 'Sprint Review',
    occurrenceId: 'occ-sprint-review',
    recurringEventId: 'sprint-review',
  });

  const sprintNaming: MeetingNaming = {
    seriesKey: 'sprint-review',
    issueKey: 'XYZ-1',
    title: 'Sprint Review',
    createdAt: at(9),
  };

  const titled = (detail: string): ActivityBlock => ({
    from: room.from,
    to: room.to,
    context: { appId: room.appId },
    evidence: [{ kind: 'window-title', at: room.from, detail }],
  });

  it('keeps the user answer when one accepted meeting merely overlaps the call', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { callNamings: [naming()], namings: [sprintNaming] },
    });

    expect(second?.group.issueKey).toBe('ABC-7');
    expect(second?.group.laneKey).toBe(CALL_LANE_KEY);
  });

  it('still offers the meeting the call overlapped, so the review can correct the answer', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { callNamings: [naming()], namings: [sprintNaming] },
    });

    expect(second?.candidates.map((candidate) => candidate.event.occurrenceId)).toEqual(['occ-sprint-review']);
  });

  it('lets a window title that names the meeting outrank the user answer', () => {
    const [, second] = match({
      calls: [meeting, room],
      blocks: [titled('Sprint Review — Discord')],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { callNamings: [naming()], namings: [sprintNaming] },
    });

    expect(second?.group.issueKey).toBe('XYZ-1');
    expect(second?.group.laneKey).toBe(CALL_LANE_KEY);
  });

  it('keeps the user answer when the meeting a title named holds no issue of its own', () => {
    const [, second] = match({
      calls: [meeting, room],
      blocks: [titled('Sprint Review — Discord')],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { callNamings: [naming()] },
    });

    expect(second?.group.issueKey).toBe('ABC-7');
    expect(second?.group.confidence).toBe('likely');
  });

  it('reads the Tempo history when the meeting it picked holds no issue of its own', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { patterns: PATTERNS },
    });

    expect(second?.group.issueKey).toBe('ABC-9');
    expect(second?.group.confidence).toBe('weak');
  });

  it('carries the meeting it overruled, so the band can show both answers', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { callNamings: [naming()], namings: [sprintNaming] },
    });

    expect(second?.group.issueKey).toBe('ABC-7');
    expect(second?.group.disputedIssueKey).toBe('XYZ-1');
  });

  it('carries the answer a window title overruled, the other way round', () => {
    const [, second] = match({
      calls: [meeting, room],
      blocks: [titled('Sprint Review — Discord')],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { callNamings: [naming()], namings: [sprintNaming] },
    });

    expect(second?.group.issueKey).toBe('XYZ-1');
    expect(second?.group.disputedIssueKey).toBe('ABC-7');
  });

  it('carries a stand-in the answer named as the work the band may be instead', () => {
    const [, second] = match({
      calls: [meeting, room],
      blocks: [titled('Sprint Review — Discord')],
      occurrences: [meetingOccurrence, overlapping],
      meetings: {
        callNamings: [naming({ target: { kind: 'stand-in', standInId: 'si-1' } })],
        namings: [sprintNaming],
      },
    });

    expect(second?.group.issueKey).toBe('XYZ-1');
    expect(second?.group.disputedStandInId).toBe('si-1');
    expect(second?.group.disputedIssueKey).toBeUndefined();
  });

  it('disputes nothing when both answers name the same work', () => {
    const [, second] = match({
      calls: [meeting, room],
      occurrences: [meetingOccurrence, overlapping],
      meetings: { callNamings: [naming()], namings: [{ ...sprintNaming, issueKey: 'ABC-7' }] },
    });

    expect(second?.group.issueKey).toBe('ABC-7');
    expect(second?.group.disputedIssueKey).toBeUndefined();
  });

  it('carries the features naming its row would remember', () => {
    const [, second] = match({ calls: [meeting, room], occurrences: [meetingOccurrence] });

    expect(second?.features.after).toBe('series:weekly');
    expect(second?.features.appId).toBe('com.hnc.discord');
  });

  it('hands a call row to callBehindRow and a meeting row to nobody', () => {
    const matches = match({ calls: [meeting, room], occurrences: [meetingOccurrence] });
    const callRow = matches[1]?.group as { from: Date; to: Date; laneKey?: string };
    const meetingRow = matches[0]?.group as { from: Date; to: Date; laneKey?: string };

    expect(callBehindRow({ row: callRow, calls: matches })?.call).toBe(room);
    expect(callBehindRow({ row: meetingRow, calls: matches })).toBeUndefined();
  });
});

describe('a call over an accepted meeting no rule counts', () => {
  const SLACK = 'com.tinyspeck.slackmacgap';

  it('is named after the meeting it overlaps', () => {
    const daily = occurrence({ at: at(9, 45), until: at(10, 15), title: 'Team Daily' });
    const calls = classifyCalls({
      events: [
        { at: at(9, 56), source: 'window', kind: 'window-focus', appId: SLACK, title: 'office (Channel) - Slack' },
        { at: at(9, 56), source: 'call', kind: 'call-start', appId: SLACK },
        { at: at(9, 57), source: 'window', kind: 'window-focus', appId: 'code', title: 'calls.ts' },
        { at: at(10, 36), source: 'call', kind: 'call-end', appId: SLACK },
        daily,
      ],
      rules: { countsAsWork: ['Discord'], neverCountsAsWork: [] },
      until: at(12),
    });

    const [found] = match({ calls, occurrences: [daily] });

    expect(found?.group.bookable).not.toBe(false);
    expect(found?.meeting?.event.occurrenceId).toBe('occ-standup');
    expect(callLabel(found!.call)).toBe('Team Daily');
  });
});
