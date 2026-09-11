import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CallWindow } from '../model/call';
import { CalendarOccurrenceEvent } from '../model/event';
import { MeetingNaming, meetingSeriesKey, rememberMeetingNaming } from '../model/meeting-naming';
import { RecurringPattern } from '../model/recurrence';
import {
  MeetingOptions,
  candidatesFor,
  occurrenceIssueKey,
  patternIssueKey,
  pickCandidate,
  unobservedOccurrences,
} from './meetings';

const at = (hour: number, minute = 0) => new Date(2026, 7, 11, hour, minute);

const meeting = (overrides: Partial<CalendarOccurrenceEvent> = {}): CalendarOccurrenceEvent => ({
  at: at(10),
  source: 'calendar',
  kind: 'calendar-event',
  occurrenceId: 'occ-sprint-planning',
  until: at(11),
  title: 'Sprint Planning',
  accepted: true,
  conferenceUrl: 'https://meet.google.com/abc-defg-hij',
  ...overrides,
});

const block = (options: { from: Date; to: Date; title?: string }): ActivityBlock => ({
  from: options.from,
  to: options.to,
  context: { appId: 'chrome' },
  evidence: options.title ? [{ kind: 'window-title', at: options.from, detail: options.title }] : [],
});

const call = (overrides: Partial<CallWindow> = {}): CallWindow => ({
  appId: 'org.mozilla.firefox',
  from: at(10),
  to: at(11),
  title: 'Mozilla Firefox',
  attendedMs: 10 * 60_000,
  countsAsWork: true,
  ...overrides,
});

/** A key in an event title is only read against configured projects — see `issueKeyInText`. */
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['ABC'] });

const pick = (options: { event?: CalendarOccurrenceEvent; blocks?: ActivityBlock[]; call?: CallWindow }) => {
  const window = { from: at(10), to: at(11) };

  return pickCandidate({
    call: options.call ?? call(),
    window,
    candidates: candidatesFor({ occurrences: [options.event ?? meeting()], window }),
    blocks: options.blocks ?? [],
  });
};

const PATTERNS: RecurringPattern[] = [
  { issueKey: 'ABC-9', weekday: at(10).getDay(), fromMinute: 9 * 60, toMinute: 11 * 60, occurrences: 5 },
];

describe('candidatesFor', () => {
  it('offers every occurrence the call overlaps, longest overlap first', () => {
    const short = meeting({ occurrenceId: 'occ-short', title: 'Standup', at: at(10, 45), until: at(11, 15) });
    const found = candidatesFor({ occurrences: [short, meeting()], window: { from: at(10), to: at(11) } });

    expect(found.map((entry) => [entry.event.title, entry.overlapMs])).toEqual([
      ['Sprint Planning', 60 * 60_000],
      ['Standup', 15 * 60_000],
    ]);
  });

  it('leaves out an occurrence that only touches the call at one instant', () => {
    const after = meeting({ occurrenceId: 'occ-after', at: at(11), until: at(12) });

    expect(candidatesFor({ occurrences: [after], window: { from: at(10), to: at(11) } })).toEqual([]);
  });
});

describe('pickCandidate', () => {
  it('is certain from a window title carrying the meet code', () => {
    const found = pick({
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'Meet - abc-defg-hij - Firefox' })],
    });

    expect(found?.match).toBe('certain');
    expect(found?.event.title).toBe('Sprint Planning');
  });

  it('is certain from a window title carrying the event name', () => {
    const found = pick({
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'Sprint Planning - Google Meet' })],
    });

    expect(found?.match).toBe('certain');
  });

  it('refuses to confirm from an event name too short to be distinctive', () => {
    const found = pick({
      event: meeting({ title: 'QA', conferenceUrl: undefined }),
      blocks: [block({ from: at(10, 2), to: at(10, 55), title: 'qa-report.ts - Code' })],
    });

    expect(found?.match).toBe('likely');
  });

  it('ignores a matching window title from outside the call', () => {
    const found = pick({ blocks: [block({ from: at(12), to: at(12, 30), title: 'Meet - abc-defg-hij - Firefox' })] });

    expect(found?.match).toBe('likely');
  });

  it('falls to likely for the one meeting the user accepted over the call', () => {
    expect(pick({})?.match).toBe('likely');
  });

  it('decides nothing when two accepted meetings overlap the call', () => {
    const window = { from: at(10), to: at(11) };
    const other = meeting({ occurrenceId: 'occ-other', title: 'Design review', conferenceUrl: undefined });

    expect(
      pickCandidate({
        call: call(),
        window,
        candidates: candidatesFor({ occurrences: [meeting(), other], window }),
        blocks: [],
      }),
    ).toBeUndefined();
  });

  it('never picks an invitation the user only ignored', () => {
    expect(pick({ event: meeting({ accepted: false }) })).toBeUndefined();
  });

  it('rules a meeting out when the call was held in a different service', () => {
    expect(pick({ call: call({ appId: 'com.hnc.Discord' }) })).toBeUndefined();
  });

  it('keeps a meeting whose own service is the one the call was held in', () => {
    const inDiscord = meeting({ conferenceUrl: 'https://discord.com/channels/1234/5678' });

    expect(pick({ event: inDiscord, call: call({ appId: 'com.hnc.Discord' }) })?.match).toBe('likely');
  });

  it('rules nothing out for a call whose application names no service at all', () => {
    expect(pick({ call: call({ appId: 'org.mozilla.firefox' }) })?.match).toBe('likely');
  });
});

describe('occurrenceIssueKey', () => {
  const named = (event: CalendarOccurrenceEvent, meetings: MeetingOptions = {}) =>
    occurrenceIssueKey({ event, meetings: { config: CONFIG, ...meetings } });

  it('takes the issue key out of the event title', () => {
    expect(named(meeting({ title: 'ABC-12 refinement' }))).toMatchObject({
      issueKey: 'ABC-12',
      keySource: 'event-title',
    });
  });

  it('reads the answer the user already gave for this series', () => {
    const namings: MeetingNaming[] = [
      { seriesKey: 'series-1', issueKey: 'ABC-4', title: 'Sprint Planning', createdAt: at(9) },
    ];

    expect(named(meeting({ recurringEventId: 'series-1' }), { namings })).toMatchObject({
      issueKey: 'ABC-4',
      keySource: 'remembered',
    });
  });

  it('names nothing when neither the title nor an answer says which issue it is', () => {
    expect(named(meeting())).toBeUndefined();
  });

  it('never reads Tempo history, which names a time of day rather than a meeting', () => {
    expect(named(meeting(), { patterns: PATTERNS })).toBeUndefined();
  });
});

describe('patternIssueKey', () => {
  it('names a call from the history of the same hour on earlier weeks', () => {
    expect(patternIssueKey({ at: at(10), meetings: { patterns: PATTERNS } })).toMatchObject({
      issueKey: 'ABC-9',
      keySource: 'tempo-history',
    });
  });

  it('names nothing when no pattern covers the instant', () => {
    expect(patternIssueKey({ at: at(15), meetings: { patterns: PATTERNS } })).toBeUndefined();
  });
});

describe('unobservedOccurrences', () => {
  it('reports an occurrence no call was heard over', () => {
    const found = unobservedOccurrences({ occurrences: [meeting()], calls: [] });

    expect(found.map((entry) => entry.event.title)).toEqual(['Sprint Planning']);
  });

  it('leaves out an occurrence a call overlaps', () => {
    expect(unobservedOccurrences({ occurrences: [meeting()], calls: [call()] })).toEqual([]);
  });

  it('counts a call the attendance gate dropped, which is still evidence the user was in something', () => {
    expect(unobservedOccurrences({ occurrences: [meeting()], calls: [call({ countsAsWork: false })] })).toEqual([]);
  });

  it('carries the issue its own title names, so the card can offer it with one press', () => {
    const found = unobservedOccurrences({
      occurrences: [meeting({ title: 'ABC-12 refinement' })],
      calls: [],
      meetings: { config: CONFIG },
    });

    expect(found[0]).toMatchObject({ issueKey: 'ABC-12', keySource: 'event-title' });
  });
});

describe('meetingSeriesKey', () => {
  it('is the provider series id when the occurrence repeats, so a rename keeps the answer', () => {
    expect(meetingSeriesKey({ recurringEventId: 'series-1', title: 'Renamed' })).toBe('series-1');
  });

  it('folds the title for a one-off event, which carries no series id', () => {
    expect(meetingSeriesKey({ title: '  Team   EA  Daily ' })).toBe('team ea daily');
  });
});

describe('rememberMeetingNaming', () => {
  it('writes the answer against the series and upper-cases the issue', () => {
    const written = rememberMeetingNaming({ namings: [], event: meeting(), issueKey: 'abc-4', at: at(12) });

    expect(written).toEqual([
      { seriesKey: 'sprint planning', issueKey: 'ABC-4', title: 'Sprint Planning', createdAt: at(12) },
    ]);
  });

  it('replaces an earlier answer for the same series rather than keeping both', () => {
    const first = rememberMeetingNaming({ namings: [], event: meeting(), issueKey: 'ABC-4', at: at(12) });
    const second = rememberMeetingNaming({ namings: first, event: meeting(), issueKey: 'ABC-5', at: at(13) });

    expect(second.map((naming) => naming.issueKey)).toEqual(['ABC-5']);
  });
});
