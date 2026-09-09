import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CallWindow } from '../model/call';
import { TimeWindow } from '../model/time-window';
import { CallMatch, matchCalls } from './calls';
import { MeetingOptions } from './meetings';
import { RecurringPattern } from './recurrence';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const call = (overrides: Partial<CallWindow> = {}): CallWindow => ({
  from: at(10),
  to: at(11),
  appId: 'com.hnc.Discord',
  title: '#standup | Braune Digital',
  countsAsWork: true,
  ...overrides,
});

const block = (options: { from: Date; to: Date }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: { appId: 'code' },
  evidence: [],
});

const match = (options: {
  calls?: CallWindow[];
  blocks?: ActivityBlock[];
  claimed?: TimeWindow[];
  meetings?: MeetingOptions;
}): CallMatch[] =>
  matchCalls({
    calls: options.calls ?? [call()],
    blocks: options.blocks ?? [],
    claimed: options.claimed ?? [],
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

  it('proposes nothing for an unclassified call', () => {
    expect(match({ calls: [call({ countsAsWork: false })] })).toEqual([]);
  });

  it('never proposes better than weak, however well the call is named', () => {
    const [found] = match({ meetings: { defaultIssueKey: 'ABC-1', patterns: PATTERNS } });

    expect(found?.group.confidence).toBe('weak');
  });

  it('lands a call on the meetings issue when nothing else names one', () => {
    const [found] = match({ meetings: { defaultIssueKey: 'ABC-1' } });

    expect(found?.group.issueKey).toBe('ABC-1');
  });

  it('prefers a standing commitment from Tempo history over the meetings issue', () => {
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
