import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { JiraCredentials } from '../jira/client';
import { SyncedWorklog } from '../model/proposal';
import { TimetrackLedgerStore } from '../store/ports';
import { TempoCredentials } from '../tempo/client';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { deleteOwnTempoWorklog$ } from './tempo-delete';

const JIRA: JiraCredentials = { host: 'team.atlassian.net', email: 'me@example.com', token: 'j' };
const TEMPO: TempoCredentials = { token: 't' };
const DAY = '2026-08-11';

const WORKLOG_RESOURCE = {
  tempoWorklogId: 98765,
  issue: { id: 10100 },
  timeSpentSeconds: 5400,
  startDate: DAY,
  startTime: '09:15:00',
  description: 'Logout on idle',
  author: { accountId: 'acc:123' },
};

const deleteTransport = (worklogs: unknown[] = [WORKLOG_RESOURCE]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      if (request.url.includes('/myself')) {
        return of({ status: 200, headers: {}, body: { accountId: 'acc:123', displayName: 'Tom' } }) as never;
      }

      if (request.url.includes('/search/jql')) {
        return of({
          status: 200,
          headers: {},
          body: { issues: [{ id: '10100', key: 'FIP-3010', fields: {} }] },
        }) as never;
      }

      if (request.method === 'DELETE') return of({ status: 204, headers: {}, body: undefined }) as never;

      return of({ status: 200, headers: {}, body: { results: worklogs, metadata: {} } }) as never;
    }),
  };

  return { transport, requests };
};

const entry = (overrides: Partial<SyncedWorklog> = {}): SyncedWorklog => ({
  proposalId: 'p1',
  day: DAY,
  tempoWorklogId: '98765',
  contentHash: 'h',
  syncedAt: new Date(2026, 7, 11, 18, 0),
  ...overrides,
});

const ledgerStore = (entries: SyncedWorklog[], options: { failRemove?: boolean } = {}) => {
  const removed: string[][] = [];
  const store: TimetrackLedgerStore = {
    entriesForDay$: () => of(entries) as Observable<SyncedWorklog[]>,
    upsert$: () => of(undefined),
    remove$: (proposalIds) => {
      removed.push(proposalIds);

      return options.failRemove ? throwError(() => new Error('store is locked')) : of(undefined);
    },
  };

  return { store, removed };
};

const run = (options: { transport: TimetrackTransport; ledger: TimetrackLedgerStore; worklogId: string }) => {
  const results: unknown[] = [];
  const errors: string[] = [];

  deleteOwnTempoWorklog$({
    transport: options.transport,
    jira: JIRA,
    tempo: TEMPO,
    ledger: options.ledger,
    day: DAY,
    worklogId: options.worklogId,
  }).subscribe({
    next: (value) => results.push(value),
    error: (error: unknown) => errors.push(error instanceof Error ? error.message : String(error)),
  });

  return { results, errors };
};

const deletes = (requests: TimetrackRequest[]) => requests.filter((request) => request.method === 'DELETE');

describe('deleteOwnTempoWorklog$', () => {
  it('deletes an own worklog of the day, and answers what it was', () => {
    const { transport, requests } = deleteTransport();
    const { store } = ledgerStore([]);

    const { results, errors } = run({ transport, ledger: store, worklogId: '98765' });

    expect(errors).toEqual([]);
    expect(deletes(requests).map((request) => request.url)).toEqual(['https://api.tempo.io/4/worklogs/98765']);
    expect(requests.find((request) => request.url.includes('/worklogs/user/'))?.url).toContain(
      '/worklogs/user/acc%3A123?from=2026-08-11&to=2026-08-11',
    );
    expect(results).toEqual([
      {
        deleted: {
          id: '98765',
          day: DAY,
          startTime: '09:15',
          minutes: 90,
          issueKey: 'FIP-3010',
          description: 'Logout on idle',
        },
      },
    ]);
  });

  it('refuses an id the account does not hold on that day, and deletes nothing', () => {
    const { transport, requests } = deleteTransport();
    const { store, removed } = ledgerStore([entry({ tempoWorklogId: '11111' })]);

    const { results, errors } = run({ transport, ledger: store, worklogId: '11111' });

    expect(results).toEqual([]);
    expect(errors).toEqual(['Your Tempo worklogs on 2026-08-11 hold no worklog 11111. Nothing was deleted.']);
    expect(deletes(requests)).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('refuses a worklog Tempo answers for another day', () => {
    const { transport, requests } = deleteTransport([{ ...WORKLOG_RESOURCE, startDate: '2026-08-12' }]);
    const { store } = ledgerStore([]);

    const { errors } = run({ transport, ledger: store, worklogId: '98765' });

    expect(errors).toHaveLength(1);
    expect(deletes(requests)).toEqual([]);
  });

  it('drops the ledger entries that owned the deleted worklog, and only those', () => {
    const { transport } = deleteTransport();
    const { store, removed } = ledgerStore([entry(), entry({ proposalId: 'p2', tempoWorklogId: '22222' })]);

    run({ transport, ledger: store, worklogId: '98765' });

    expect(removed).toEqual([['p1']]);
  });

  it('reports a ledger that kept its entry, after tempo dropped the worklog', () => {
    const { transport } = deleteTransport();
    const { store } = ledgerStore([entry()], { failRemove: true });

    const { results, errors } = run({ transport, ledger: store, worklogId: '98765' });

    expect(errors).toEqual([]);
    expect(results).toEqual([expect.objectContaining({ unrecorded: 'store is locked' })]);
  });
});
