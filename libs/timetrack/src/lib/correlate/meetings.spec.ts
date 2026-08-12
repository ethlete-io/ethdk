import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CalendarOccurrenceEvent } from '../model/event';
import { MeetingOptions, matchMeetings } from './meetings';
import { RecurringPattern } from './recurrence';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const meeting = (overrides: Partial<CalendarOccurrenceEvent> = {}): CalendarOccurrenceEvent => ({
  at: at(10),
  source: 'calendar',
  kind: 'calendar-event',
  until: at(11),
  title: 'Sprint Planning',
  accepted: true,
  conferenceUrl: 'https://meet.google.com/abc-defg-hij',
  ...overrides,
});

const block = (options: { from: Date; to: Date; title?: string; branch?: string }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: { appId: 'chrome', branch: options.branch },
  evidence: options.title ? [{ kind: 'window-title', at: options.from, detail: options.title }] : [],
});

const match = (options: { event?: CalendarOccurrenceEvent; blocks?: ActivityBlock[]; meetings?: MeetingOptions }) => {
  const found = matchMeetings({
    events: [options.event ?? meeting()],
    blocks: options.blocks ?? [],
    meetings: options.meetings,
  });

  return found[0]!;
};

const PATTERNS: RecurringPattern[] = [
  { issueKey: 'FIP-9', weekday: at(10).getDay(), fromMinute: 9 * 60, toMinute: 11 * 60, occurrences: 5 },
];

describe('matchMeetings', () => {
  it('confirms attendance from a window title carrying the meet code', () => {
    const found = match({
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'Meet - abc-defg-hij - Google Chrome' })],
    });

    expect(found.attendance).toBe('confirmed');
  });

  it('confirms attendance from a window title carrying the event name', () => {
    const found = match({
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'Sprint Planning - Google Meet' })],
    });

    expect(found.attendance).toBe('confirmed');
  });

  it('ignores a matching window title from outside the meeting', () => {
    const found = match({
      blocks: [block({ from: at(12), to: at(12, 30), title: 'Meet - abc-defg-hij - Google Chrome' })],
    });

    expect(found.attendance).toBe('unobserved');
    expect(found.overlapMs).toBe(0);
  });

  it('reports activity during the meeting as observed, with the overlap it double-claims', () => {
    const found = match({
      blocks: [block({ from: at(10, 30), to: at(11, 30), title: 'app.ts - fut-frontend - Code' })],
    });

    expect(found.attendance).toBe('observed');
    expect(found.overlapMs).toBe(30 * 60_000);
  });

  it('sums the overlap across several blocks', () => {
    const found = match({
      blocks: [block({ from: at(9, 45), to: at(10, 15) }), block({ from: at(10, 45), to: at(11, 15) })],
    });

    expect(found.overlapMs).toBe(30 * 60_000);
  });

  it('logs the calendar duration, not the time the collectors saw', () => {
    const found = match({ blocks: [block({ from: at(10, 5), to: at(10, 6), title: 'Meet - abc-defg-hij' })] });

    expect(found.group.observedMs).toBe(60 * 60_000);
  });

  it('takes the issue key out of the event title and is certain once attendance is confirmed', () => {
    const found = match({
      event: meeting({ title: 'FIP-2177 refinement' }),
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'FIP-2177 refinement - Google Meet' })],
    });

    expect(found.group.issueKey).toBe('FIP-2177');
    expect(found.keySource).toBe('event-title');
    expect(found.group.confidence).toBe('certain');
  });

  it('drops to likely for a title key nothing observed', () => {
    const found = match({ event: meeting({ title: 'FIP-2177 refinement' }) });

    expect(found.group.confidence).toBe('likely');
  });

  it('never trusts an unanswered invitation, whatever its title says', () => {
    const found = match({ event: meeting({ title: 'FIP-2177 refinement', accepted: false }) });

    expect(found.group.confidence).toBe('weak');
    expect(found.group.evidence[0]?.detail).toContain('never answered');
  });

  it('falls back to a recurring tempo pattern and stays weak', () => {
    const found = match({ meetings: { patterns: PATTERNS } });

    expect(found.group.issueKey).toBe('FIP-9');
    expect(found.keySource).toBe('tempo-history');
    expect(found.group.confidence).toBe('weak');
    expect(found.group.evidence.map((entry) => entry.kind)).toEqual(['calendar', 'tempo-history']);
  });

  it('lifts a pattern key to likely once the meeting is confirmed', () => {
    const found = match({
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'Meet - abc-defg-hij' })],
      meetings: { patterns: PATTERNS },
    });

    expect(found.group.confidence).toBe('likely');
  });

  it('uses the configured meeting ticket only when nothing else names one', () => {
    const found = match({ meetings: { defaultIssueKey: 'FIP-1', patterns: PATTERNS } });

    expect(found.group.issueKey).toBe('FIP-9');
    expect(match({ meetings: { defaultIssueKey: 'FIP-1' } }).group.issueKey).toBe('FIP-1');
  });

  it('leaves a meeting nothing can name unattributed rather than guessing', () => {
    const found = match({});

    expect(found.group.issueKey).toBeUndefined();
    expect(found.keySource).toBeUndefined();
    expect(found.group.confidence).toBe('weak');
  });

  it('describes the row from the event name and keeps the clock times', () => {
    const found = match({});

    expect(found.group.evidence[0]).toEqual({
      kind: 'calendar',
      at: at(10),
      detail: 'calendar event _Sprint Planning_ 10:00-11:00, you accepted',
      summary: 'Sprint Planning',
    });
    expect(found.group.from).toEqual(at(10));
    expect(found.group.to).toEqual(at(11));
    expect(found.group.blocks).toEqual([]);
  });

  it('ignores a conference url with no usable identifier', () => {
    const found = match({
      event: meeting({ conferenceUrl: 'https://meet.google.com/' }),
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'Inbox - Google Chrome' })],
    });

    expect(found.attendance).toBe('observed');
  });

  it('refuses to confirm from an event name too short to be distinctive', () => {
    const found = match({
      event: meeting({ title: 'QA', conferenceUrl: undefined }),
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'qa-report.ts - fut-frontend - Code' })],
    });

    expect(found.attendance).toBe('observed');
  });

  it('returns the day meetings in calendar order and skips activity events', () => {
    const found = matchMeetings({
      events: [
        meeting({ at: at(14), until: at(15), title: 'Retro' }),
        { at: at(9), source: 'window', kind: 'window-focus', appId: 'code', title: 'app.ts' },
        meeting(),
      ],
      blocks: [],
    });

    expect(found.map((entry) => entry.event.title)).toEqual(['Sprint Planning', 'Retro']);
  });
});
