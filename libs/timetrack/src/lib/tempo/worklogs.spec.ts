import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { TempoWorklog, fetchTempoWorklogs$, toHistoricalWorklogs } from './worklogs';

const CREDENTIALS: TempoCredentials = { token: 't' };

const worklogTransport = (results: unknown[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: { results, metadata: {} } }) as never;
    }),
  };

  return { transport, requests };
};

const worklogs$ = (transport: TimetrackTransport) =>
  fetchTempoWorklogs$({
    transport,
    credentials: CREDENTIALS,
    accountId: 'acc:123',
    from: new Date(2026, 7, 11),
    to: new Date(2026, 7, 11),
  });

const RESOURCE = {
  tempoWorklogId: 98765,
  issue: { id: 10100 },
  timeSpentSeconds: 5400,
  billableSeconds: 3600,
  startDate: '2026-08-11',
  startTime: '09:30:00',
  description: 'Logout on idle',
  author: { accountId: 'acc:123' },
  attributes: { values: [{ key: '_Billable_', value: true }, { key: '_Category_', value: 'Dev' }, { key: '_Empty_' }] },
};

describe('fetchTempoWorklogs$', () => {
  it('reads one user over an inclusive range of days', () => {
    const { transport, requests } = worklogTransport([]);

    worklogs$(transport).subscribe();

    expect(requests[0]?.url).toContain('/4/worklogs/user/acc%3A123');
    expect(requests[0]?.url).toContain('from=2026-08-11');
    expect(requests[0]?.url).toContain('to=2026-08-11');
  });

  it('normalizes a worklog, placing it at the local wall clock tempo reported', () => {
    const { transport } = worklogTransport([RESOURCE]);
    const seen = vi.fn();

    worklogs$(transport).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([
      {
        id: '98765',
        issueId: '10100',
        authorAccountId: 'acc:123',
        from: new Date(2026, 7, 11, 9, 30, 0),
        durationMs: 5_400_000,
        billableMs: 3_600_000,
        description: 'Logout on idle',
        attributes: { _Billable_: 'true', _Category_: 'Dev' },
      },
    ]);
  });

  it('accepts a time with no seconds and defaults a missing time to midnight', () => {
    const { transport } = worklogTransport([
      { ...RESOURCE, startTime: '14:05' },
      { ...RESOURCE, tempoWorklogId: 2, startTime: undefined },
    ]);
    const seen = vi.fn();

    worklogs$(transport).subscribe(seen);

    const read = seen.mock.calls[0]?.[0] as TempoWorklog[];

    expect(read[0]?.from).toEqual(new Date(2026, 7, 11, 14, 5, 0));
    expect(read[1]?.from).toEqual(new Date(2026, 7, 11, 0, 0, 0));
  });

  it('drops a worklog that cannot be identified or placed rather than inventing a value', () => {
    const { transport } = worklogTransport([
      { ...RESOURCE, tempoWorklogId: undefined },
      { ...RESOURCE, issue: {} },
      { ...RESOURCE, startDate: '11/08/2026' },
      { ...RESOURCE, startTime: 'lunchtime' },
    ]);
    const seen = vi.fn();

    worklogs$(transport).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([]);
  });

  it('defaults an absent duration and description instead of failing the day', () => {
    const { transport } = worklogTransport([
      { tempoWorklogId: 5, issue: { id: 1 }, startDate: '2026-08-11', startTime: '10:00:00' },
    ]);
    const seen = vi.fn();

    worklogs$(transport).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([
      {
        id: '5',
        issueId: '1',
        authorAccountId: '',
        from: new Date(2026, 7, 11, 10, 0, 0),
        durationMs: 0,
        billableMs: 0,
        description: '',
        attributes: {},
      },
    ]);
  });
});

describe('toHistoricalWorklogs', () => {
  const worklog = (overrides: Partial<TempoWorklog>): TempoWorklog => ({
    id: '1',
    issueId: '10100',
    authorAccountId: 'acc:123',
    from: new Date(2026, 7, 3, 9, 0),
    durationMs: 1_800_000,
    billableMs: 0,
    description: '',
    attributes: {},
    ...overrides,
  });

  it('keys the recurrence feed by the resolved issue key', () => {
    const history = toHistoricalWorklogs({
      worklogs: [worklog({})],
      keysByIssueId: new Map([['10100', 'FIP-3010']]),
    });

    expect(history).toEqual([{ issueKey: 'FIP-3010', from: new Date(2026, 7, 3, 9, 0), durationMs: 1_800_000 }]);
  });

  it('drops a worklog whose issue id jira could not resolve', () => {
    const history = toHistoricalWorklogs({
      worklogs: [worklog({ issueId: '99999' })],
      keysByIssueId: new Map([['10100', 'FIP-3010']]),
    });

    expect(history).toEqual([]);
  });
});
