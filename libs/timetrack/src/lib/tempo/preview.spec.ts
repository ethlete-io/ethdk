import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { JiraCredentials } from '../jira/client';
import { SyncedWorklog, WorklogProposal } from '../model/proposal';
import { TimetrackLedgerStore } from '../store/ports';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { TempoCredentials } from './client';
import { previewTempoSync$ } from './preview';

const HOUR = 3_600_000;
const JIRA: JiraCredentials = { host: 'team.atlassian.net', email: 'me@example.com', token: 'j' };
const TEMPO: TempoCredentials = { token: 't' };

const proposal = (overrides: Partial<WorklogProposal> = {}): WorklogProposal => ({
  id: 'p1',
  issueKey: 'FIP-3010',
  from: new Date(2026, 7, 11, 9, 0),
  to: new Date(2026, 7, 11, 10, 0),
  durationMs: HOUR,
  observedMs: HOUR,
  description: 'Logout on idle',
  confidence: 'certain',
  evidence: [],
  state: 'accepted',
  ...overrides,
});

const WORKLOG_RESOURCE = {
  tempoWorklogId: 98765,
  issue: { id: 10100 },
  timeSpentSeconds: HOUR / 1000,
  startDate: '2026-08-11',
  startTime: '09:00:00',
  description: 'Logout on idle',
  author: { accountId: 'acc:123' },
};

const byKeyQuery = (request: TimetrackRequest) => request.url.includes('key%20in');
const byIdQuery = (request: TimetrackRequest) => request.url.includes('id%20in');

const previewTransport = (options: { worklogs?: unknown[]; issues?: unknown[]; issuesById?: unknown[] } = {}) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      if (request.url.includes('/myself')) {
        return of({ status: 200, headers: {}, body: { accountId: 'acc:123', displayName: 'Tom' } }) as never;
      }

      if (request.url.includes('/search/jql')) {
        const issues = byIdQuery(request)
          ? (options.issuesById ?? [])
          : (options.issues ?? [{ id: '10100', key: 'FIP-3010', fields: {} }]);

        return of({ status: 200, headers: {}, body: { issues } }) as never;
      }

      return of({ status: 200, headers: {}, body: { results: options.worklogs ?? [], metadata: {} } }) as never;
    }),
  };

  return { transport, requests };
};

const ledgerStore = (entries: SyncedWorklog[] = []) => {
  const asked: string[] = [];
  const store: TimetrackLedgerStore = {
    entriesForDay$: (day) => {
      asked.push(day);

      return of(entries) as Observable<SyncedWorklog[]>;
    },
    upsert$: () => of(undefined),
    remove$: () => of(undefined),
  };

  return { store, asked };
};

const preview = (options: {
  transport: TimetrackTransport;
  ledger: TimetrackLedgerStore;
  proposals?: WorklogProposal[];
}) =>
  previewTempoSync$({
    transport: options.transport,
    jira: JIRA,
    tempo: TEMPO,
    ledger: options.ledger,
    proposals: options.proposals ?? [proposal()],
    day: '2026-08-11',
  });

describe('previewTempoSync$', () => {
  it('resolves the account first and scopes the tempo read to it', () => {
    const { transport, requests } = previewTransport();
    const { store } = ledgerStore();

    preview({ transport, ledger: store }).subscribe();

    expect(requests[0]?.url).toContain('/rest/api/3/myself');
    expect(requests.some((request) => request.url.includes('/worklogs/user/acc%3A123'))).toBe(true);
  });

  it('reads the day itself at both ends, so the next day is not read into this day', () => {
    const { transport, requests } = previewTransport();
    const { store } = ledgerStore();

    preview({ transport, ledger: store }).subscribe();

    const worklogs = requests.find((request) => request.url.includes('/worklogs/user/'));

    expect(worklogs?.url).toContain('from=2026-08-11&to=2026-08-11');
  });

  it('plans a delete for a worklog whose proposal the day no longer produces', () => {
    const { transport } = previewTransport({ worklogs: [WORKLOG_RESOURCE] });
    const { store } = ledgerStore([
      { proposalId: 'gone', day: '2026-08-11', tempoWorklogId: '98765', contentHash: 'h', syncedAt: new Date() },
    ]);
    const seen = vi.fn();

    preview({ transport, ledger: store }).subscribe(seen);

    const result = seen.mock.calls[0]?.[0];

    expect(result.plan.deletes).toEqual([{ proposalId: 'gone', tempoWorklogId: '98765', reason: 'proposal-removed' }]);
    expect(result.plan.foreign).toEqual([]);
  });

  it('plans a create for a proposal nothing in tempo covers', () => {
    const { transport } = previewTransport();
    const { store, asked } = ledgerStore();
    const seen = vi.fn();

    preview({ transport, ledger: store }).subscribe(seen);

    const result = seen.mock.calls[0]?.[0];

    expect(asked[0]).toBe('2026-08-11');
    expect(result.account).toEqual({ accountId: 'acc:123', displayName: 'Tom', emailAddress: undefined });
    expect(result.plan.creates).toHaveLength(1);
    expect(result.plan.creates[0]).toMatchObject({ issueId: '10100', reason: 'new' });
  });

  it('reports a worklog no ledger entry points at as foreign, never as a write', () => {
    const { transport } = previewTransport({ worklogs: [WORKLOG_RESOURCE] });
    const { store } = ledgerStore();
    const seen = vi.fn();

    preview({ transport, ledger: store }).subscribe(seen);

    const result = seen.mock.calls[0]?.[0];

    expect(result.plan.foreign.map((worklog: { id: string }) => worklog.id)).toEqual(['98765']);
    expect(result.plan.deletes).toEqual([]);
    expect(result.remote).toHaveLength(1);
  });

  it('names a foreign worklog by its issue key, resolving only the ids the proposals did not cover', () => {
    const { transport, requests } = previewTransport({
      worklogs: [{ ...WORKLOG_RESOURCE, issue: { id: 10200 } }],
      issuesById: [{ id: '10200', key: 'FIP-4020', fields: {} }],
    });
    const { store } = ledgerStore();
    const seen = vi.fn();

    preview({ transport, ledger: store }).subscribe(seen);

    expect(requests.filter(byIdQuery)).toHaveLength(1);
    expect(requests.filter(byKeyQuery)).toHaveLength(1);
    expect(seen.mock.calls[0]?.[0].keysByIssueId.get('10200')).toBe('FIP-4020');
  });

  it('does not ask jira again when the proposals already resolved every remote issue id', () => {
    const { transport, requests } = previewTransport({ worklogs: [WORKLOG_RESOURCE] });
    const { store } = ledgerStore();

    preview({ transport, ledger: store }).subscribe();

    expect(requests.filter((request) => request.url.includes('/search/jql'))).toHaveLength(1);
  });

  it('reports a proposal whose key jira does not know as unresolved', () => {
    const { transport } = previewTransport({ issues: [] });
    const { store } = ledgerStore();
    const seen = vi.fn();

    preview({ transport, ledger: store }).subscribe(seen);

    const result = seen.mock.calls[0]?.[0];

    expect(result.plan.unresolved.map((entry: WorklogProposal) => entry.id)).toEqual(['p1']);
    expect(result.plan.creates).toEqual([]);
  });

  it('fails without reading tempo when jira rejects the token', () => {
    const requests: TimetrackRequest[] = [];
    const transport: TimetrackTransport = {
      request$: vi.fn((request: TimetrackRequest) => {
        requests.push(request);

        return of({ status: 401, headers: {}, body: {} }) as never;
      }),
    };
    const { store } = ledgerStore();
    const failed = vi.fn();

    preview({ transport, ledger: store }).subscribe({ error: failed });

    expect(failed.mock.calls[0]?.[0]).toMatchObject({ name: 'JiraRequestError', status: 401 });
    expect(requests).toHaveLength(1);
  });
});
