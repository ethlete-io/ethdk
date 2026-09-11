import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { JiraCredentials } from '../jira/client';
import { RecurringPattern } from '../model/recurrence';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { TempoHistory, fetchRecurringPatterns$, fetchTempoHistory$ } from './fetch-patterns';

const HOUR = 3_600_000;
const JIRA: JiraCredentials = { host: 'team.atlassian.net', email: 'me@example.com', token: 'j' };
const TEMPO: TempoCredentials = { token: 't' };
const UNTIL = new Date(2026, 8, 10, 18, 0);

/** Four Mondays before `UNTIL`, which is a Thursday. */
const MONDAYS = ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'];

const worklogResource = (options: { id: number; issueId: number; day: string; time: string; hours: number }) => ({
  tempoWorklogId: options.id,
  issue: { id: options.issueId },
  timeSpentSeconds: (options.hours * HOUR) / 1000,
  startDate: options.day,
  startTime: options.time,
  description: 'Weekly',
  author: { accountId: 'acc:123' },
});

const patternTransport = (options: { worklogs?: unknown[]; issuesById?: unknown[] } = {}) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      if (request.url.includes('/myself')) {
        return of({ status: 200, headers: {}, body: { accountId: 'acc:123', displayName: 'Tom' } }) as never;
      }

      if (request.url.includes('/search/jql')) {
        return of({ status: 200, headers: {}, body: { issues: options.issuesById ?? [] } }) as never;
      }

      return of({ status: 200, headers: {}, body: { results: options.worklogs ?? [], metadata: {} } }) as never;
    }),
  };

  return { transport, requests };
};

const readInto = (source: Observable<RecurringPattern[]>) => {
  let patterns: RecurringPattern[] = [];

  source.subscribe((value) => (patterns = value));

  return patterns;
};

describe('fetchRecurringPatterns$', () => {
  it('turns a weekly slot in the history into a pattern', () => {
    const { transport } = patternTransport({
      worklogs: MONDAYS.map((day, index) =>
        worklogResource({ id: index + 1, issueId: 10100, day, time: '09:15:00', hours: 1 }),
      ),
      issuesById: [{ id: '10100', key: 'BD-2049', fields: {} }],
    });

    const patterns = readInto(fetchRecurringPatterns$({ transport, jira: JIRA, tempo: TEMPO, until: UNTIL }));

    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.issueKey).toBe('BD-2049');
    expect(patterns[0]?.weekday).toBe(1);
    expect(patterns[0]?.occurrences).toBe(4);
  });

  it('reads the span back from the last day, not the day alone', () => {
    const { transport, requests } = patternTransport();

    fetchRecurringPatterns$({ transport, jira: JIRA, tempo: TEMPO, until: UNTIL, weeks: 2 }).subscribe();

    const worklogs = requests.find((request) => request.url.includes('/worklogs/user/'));

    expect(worklogs?.url).toContain('from=2026-08-27');
    expect(worklogs?.url).toContain('to=2026-09-10');
  });

  it('asks Jira for nothing when the history is empty', () => {
    const { transport, requests } = patternTransport();

    expect(readInto(fetchRecurringPatterns$({ transport, jira: JIRA, tempo: TEMPO, until: UNTIL }))).toEqual([]);
    expect(requests.some((request) => request.url.includes('/search/jql'))).toBe(false);
  });

  it('drops a worklog whose issue id Jira cannot name', () => {
    const { transport } = patternTransport({
      worklogs: MONDAYS.map((day, index) =>
        worklogResource({ id: index + 1, issueId: 10100, day, time: '09:15:00', hours: 1 }),
      ),
      issuesById: [],
    });

    expect(readInto(fetchRecurringPatterns$({ transport, jira: JIRA, tempo: TEMPO, until: UNTIL }))).toEqual([]);
  });
});

describe('fetchTempoHistory$', () => {
  it('names every issue the span logged against, out of the same read the patterns come from', () => {
    const { transport, requests } = patternTransport({
      worklogs: [
        worklogResource({ id: 1, issueId: 10100, day: '2026-08-17', time: '09:15:00', hours: 1 }),
        worklogResource({ id: 2, issueId: 10200, day: '2026-09-07', time: '13:00:00', hours: 2 }),
      ],
      issuesById: [
        { id: '10100', key: 'BD-2049', fields: {} },
        { id: '10200', key: 'ET-772', fields: {} },
      ],
    });

    let history: TempoHistory | null = null;

    fetchTempoHistory$({ transport, jira: JIRA, tempo: TEMPO, until: UNTIL }).subscribe((value) => (history = value));

    expect(history?.loggedIssues.map((issue) => issue.issueKey)).toEqual(['ET-772', 'BD-2049']);
    expect(requests.filter((request) => request.url.includes('/worklogs/user/'))).toHaveLength(1);
  });

  it('names nothing when the history is empty, and asks Jira nothing either', () => {
    const { transport } = patternTransport();

    let history: TempoHistory | null = null;

    fetchTempoHistory$({ transport, jira: JIRA, tempo: TEMPO, until: UNTIL }).subscribe((value) => (history = value));

    expect(history).toEqual({ patterns: [], loggedIssues: [] });
  });
});
