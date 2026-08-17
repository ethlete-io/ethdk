import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { JiraCredentials } from '../jira/client';
import { SyncedWorklog } from '../model/proposal';
import { TimetrackLedgerStore } from '../store/ports';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { TempoDayCoverage } from './coverage';
import { fetchTempoDayCoverage$ } from './fetch-coverage';

const HOUR = 3_600_000;
const DAY = '2026-08-10';
const JIRA: JiraCredentials = { host: 'team.atlassian.net', email: 'me@example.com', token: 'j' };
const TEMPO: TempoCredentials = { token: 't' };
const OBSERVED_AT = new Date(2026, 7, 11, 18, 0);

const worklogResource = (options: { id: number; issueId: number; hours: number }) => ({
  tempoWorklogId: options.id,
  issue: { id: options.issueId },
  timeSpentSeconds: (options.hours * HOUR) / 1000,
  startDate: DAY,
  startTime: '09:00:00',
  description: 'Logged by hand',
  author: { accountId: 'acc:123' },
});

const ledgerEntry = (overrides: Partial<SyncedWorklog>): SyncedWorklog => ({
  proposalId: 'p1',
  tempoWorklogId: '1',
  issueKey: 'FIP-2964',
  day: DAY,
  contentHash: 'hash',
  syncedAt: OBSERVED_AT,
  ...overrides,
});

const coverageTransport = (options: { worklogs?: unknown[]; issuesById?: unknown[] } = {}) => {
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

const ledgerStore = (entries: SyncedWorklog[] = []): TimetrackLedgerStore => ({
  entriesForDay$: () => of(entries) as Observable<SyncedWorklog[]>,
  upsert$: () => of(undefined),
  remove$: () => of(undefined),
});

const read = (options: { transport: TimetrackTransport; ledger?: TimetrackLedgerStore }) =>
  fetchTempoDayCoverage$({
    transport: options.transport,
    jira: JIRA,
    tempo: TEMPO,
    ledger: options.ledger ?? ledgerStore(),
    day: DAY,
    observedAt: OBSERVED_AT,
  });

const readInto = (source: Observable<TempoDayCoverage>) => {
  let coverage: TempoDayCoverage | null = null;

  source.subscribe((value) => (coverage = value));

  return coverage as TempoDayCoverage | null;
};

describe('fetchTempoDayCoverage$', () => {
  it('totals the day per issue', () => {
    const { transport } = coverageTransport({
      worklogs: [
        worklogResource({ id: 1, issueId: 10100, hours: 1.5 }),
        worklogResource({ id: 2, issueId: 10100, hours: 1.5 }),
        worklogResource({ id: 3, issueId: 10200, hours: 0.75 }),
      ],
      issuesById: [
        { id: '10100', key: 'FIP-2964', fields: {} },
        { id: '10200', key: 'BD-2049', fields: {} },
      ],
    });

    const coverage = readInto(read({ transport }));

    expect(coverage?.day).toBe(DAY);
    expect(coverage?.observedAt).toEqual(OBSERVED_AT);
    expect(coverage?.issues).toEqual([
      { issueKey: 'FIP-2964', coveredMs: 3 * HOUR },
      { issueKey: 'BD-2049', coveredMs: 0.75 * HOUR },
    ]);
  });

  it('leaves out what this app wrote, which the day already counts as its own', () => {
    const { transport } = coverageTransport({
      worklogs: [worklogResource({ id: 1, issueId: 10100, hours: 2 })],
      issuesById: [{ id: '10100', key: 'FIP-2964', fields: {} }],
    });

    const coverage = readInto(read({ transport, ledger: ledgerStore([ledgerEntry({ tempoWorklogId: '1' })]) }));

    expect(coverage?.issues).toEqual([]);
  });

  it('reads the day itself at both ends, so the next day is not read into it', () => {
    const { transport, requests } = coverageTransport();

    read({ transport }).subscribe();

    const worklogs = requests.find((request) => request.url.includes('/worklogs/user/'));

    expect(worklogs?.url).toContain(`from=${DAY}`);
    expect(worklogs?.url).toContain(`to=${DAY}`);
  });

  it('asks Jira for nothing when the day holds no foreign worklog', () => {
    const { transport, requests } = coverageTransport();

    read({ transport }).subscribe();

    expect(requests.some((request) => request.url.includes('/search/jql'))).toBe(false);
  });
});
