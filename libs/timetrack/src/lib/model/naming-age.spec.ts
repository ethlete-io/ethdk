import { describe, expect, it } from 'vitest';
import { CallNaming } from './call-naming';
import { MeetingNaming } from './meeting-naming';
import { agedNamings, namedIssueKeys } from './naming-age';

const NOW = new Date('2026-09-15T10:00:00Z');

const meeting = (issueKey: string): MeetingNaming => ({
  seriesKey: `series-${issueKey}`,
  issueKey,
  title: 'The weekly one',
  createdAt: new Date('2026-01-05T09:00:00Z'),
});

const call = (issueKey: string): CallNaming => ({
  appId: 'com.example.voice',
  weekday: 1,
  durationBand: '15-30',
  startMinute: 600,
  target: { kind: 'issue', issueKey },
  label: 'The room',
  createdAt: new Date('2026-01-05T09:00:00Z'),
});

const standInCall: CallNaming = { ...call('ABC-1'), target: { kind: 'stand-in', standInId: 'si-1' } };

const touched = (issueKey: string, at: string) => new Map([[issueKey, new Date(at)]]);

describe('namedIssueKeys', () => {
  it('lists each key once and leaves a stand-in record out', () => {
    expect(namedIssueKeys({ namings: [meeting('ABC-1')], callNamings: [call('ABC-1'), standInCall] })).toEqual([
      'ABC-1',
    ]);
  });
});

describe('agedNamings', () => {
  it('reports a record whose ticket has been quiet past the limit', () => {
    const [only] = agedNamings({
      namings: [meeting('ABC-1')],
      callNamings: [],
      touchedAt: touched('ABC-1', '2026-01-05T10:00:00Z'),
      now: NOW,
    });

    expect(only).toEqual({
      issueKey: 'ABC-1',
      label: 'The weekly one',
      touchedAt: new Date('2026-01-05T10:00:00Z'),
      quietDays: 253,
    });
  });

  it('leaves a record alone whose ticket was touched inside the limit', () => {
    expect(
      agedNamings({
        namings: [meeting('ABC-1')],
        callNamings: [],
        touchedAt: touched('ABC-1', '2026-08-15T10:00:00Z'),
        now: NOW,
      }),
    ).toEqual([]);
  });

  it('leaves a record alone whose ticket Jira answered nothing for', () => {
    expect(agedNamings({ namings: [meeting('ABC-1')], callNamings: [], touchedAt: new Map(), now: NOW })).toEqual([]);
  });

  it('reports a call record too, by the issue it names', () => {
    const [only] = agedNamings({
      namings: [],
      callNamings: [call('ABC-2')],
      touchedAt: touched('ABC-2', '2026-01-05T10:00:00Z'),
      now: NOW,
    });

    expect(only?.label).toBe('The room');
  });

  it('reports a ticket both stores name once', () => {
    expect(
      agedNamings({
        namings: [meeting('ABC-1')],
        callNamings: [call('ABC-1')],
        touchedAt: touched('ABC-1', '2026-01-05T10:00:00Z'),
        now: NOW,
      }),
    ).toHaveLength(1);
  });

  it('reports nothing at all when the limit is turned off', () => {
    expect(
      agedNamings({
        namings: [meeting('ABC-1')],
        callNamings: [],
        touchedAt: touched('ABC-1', '2026-01-05T10:00:00Z'),
        now: NOW,
        quietAfterDays: 0,
      }),
    ).toEqual([]);
  });
});
