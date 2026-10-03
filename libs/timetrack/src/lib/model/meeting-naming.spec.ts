import { describe, expect, it } from 'vitest';
import { MeetingNaming, meetingSeriesKey, namedIssueFor, rememberMeetingNaming } from './meeting-naming';

const AT = new Date(2026, 7, 11, 12);

describe('meetingSeriesKey', () => {
  it('keys a recurring occurrence by its series, so a rename keeps the answer', () => {
    expect(meetingSeriesKey({ recurringEventId: 's1', title: 'Daily' })).toBe(
      meetingSeriesKey({ recurringEventId: 's1', title: 'Daily (moved)' }),
    );
  });

  it('keys a one-off by its folded title, ignoring case and runs of whitespace', () => {
    expect(meetingSeriesKey({ title: '  Sprint  Planning\t' })).toBe('sprint planning');
  });
});

describe('rememberMeetingNaming', () => {
  it('replaces the earlier answer for the same series rather than adding a second', () => {
    const first = rememberMeetingNaming({ namings: [], event: { title: 'Daily' }, issueKey: 'fip-1', at: AT });
    const second = rememberMeetingNaming({ namings: first, event: { title: 'DAILY' }, issueKey: ' FIP-2 ', at: AT });

    expect(second).toEqual<MeetingNaming[]>([{ seriesKey: 'daily', issueKey: 'FIP-2', title: 'DAILY', createdAt: AT }]);
  });

  it('keeps the answers for other series', () => {
    const namings = rememberMeetingNaming({
      namings: [{ seriesKey: 'other', issueKey: 'FIP-9', title: 'Other', createdAt: AT }],
      event: { recurringEventId: 's1', title: 'Daily' },
      issueKey: 'FIP-1',
      at: AT,
    });

    expect(namings.map((naming) => naming.seriesKey)).toEqual(['other', 's1']);
  });
});

describe('namedIssueFor', () => {
  it('finds nothing in an empty store', () => {
    expect(namedIssueFor({ event: { title: 'Daily' }, namings: [] })).toBeUndefined();
  });

  it('does not answer a series with the naming of a one-off that shares its title', () => {
    const namings = rememberMeetingNaming({ namings: [], event: { title: 'Daily' }, issueKey: 'FIP-1', at: AT });

    expect(namedIssueFor({ event: { recurringEventId: 's1', title: 'Daily' }, namings })).toBeUndefined();
  });
});
