import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { WorklogProposal } from '../model/proposal';
import { TimetrackRequest, TimetrackResponse, TimetrackTransport } from '../transport/ports';
import { TempoWorkAttribute } from './attributes';
import { TempoCredentials } from './client';
import { TempoSyncPlan, contentHashOf } from './diff';
import { TempoSyncOutcome, executeTempoSync$ } from './execute';
import { TempoMarkerScheme } from './marker';

const CREDENTIALS: TempoCredentials = { token: 'tempo-secret' };
const HOUR = 3_600_000;
const SYNCED_AT = new Date(2026, 7, 11, 18, 0);
const SUFFIX: TempoMarkerScheme = { kind: 'description-suffix' };

const REQUIRED_CATEGORY: TempoWorkAttribute = {
  key: '_Category_',
  name: 'Work category',
  type: 'STATIC_LIST',
  required: true,
  values: ['dev', 'ops'],
};

const stubTransport = (responses: Partial<TimetrackResponse<unknown>>[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      const response = responses[requests.length] ?? { status: 200, body: { tempoWorklogId: 900 + requests.length } };

      requests.push(request);

      return of({ status: response.status ?? 200, headers: {}, body: response.body }) as never;
    }),
  };

  return { transport, requests };
};

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

const emptyPlan = (): TempoSyncPlan => ({
  creates: [],
  updates: [],
  deletes: [],
  unchanged: [],
  skipped: [],
  unresolved: [],
  staleLedgerProposalIds: [],
  foreign: [],
});

const planWith = (parts: Partial<TempoSyncPlan>): TempoSyncPlan => ({ ...emptyPlan(), ...parts });

const createOf = (target = proposal()) => ({
  proposal: target,
  issueId: '10100',
  contentHash: contentHashOf({ proposal: target }),
  reason: 'new' as const,
});

const updateOf = (target = proposal(), tempoWorklogId = 'w1') => ({
  proposal: target,
  issueId: '10100',
  tempoWorklogId,
  contentHash: contentHashOf({ proposal: target }),
  reason: 'content-changed' as const,
});

const execute = (options: {
  transport: TimetrackTransport;
  plan: TempoSyncPlan;
  workAttributes?: TempoWorkAttribute[];
  attributesByProposalId?: Record<string, Record<string, string | number | boolean>>;
  marker?: TempoMarkerScheme;
}) => {
  let outcome: TempoSyncOutcome | undefined;

  executeTempoSync$({
    transport: options.transport,
    credentials: CREDENTIALS,
    plan: options.plan,
    authorAccountId: 'acc:123',
    workAttributes: options.workAttributes,
    attributesByProposalId: options.attributesByProposalId,
    marker: options.marker,
    syncedAt: SYNCED_AT,
  }).subscribe((result) => (outcome = result));

  if (!outcome) throw new Error('the sync did not emit an outcome');

  return outcome;
};

describe('executeTempoSync$', () => {
  it('writes nothing for an empty plan', () => {
    const { transport, requests } = stubTransport([]);
    const outcome = execute({ transport, plan: emptyPlan() });

    expect(requests).toEqual([]);
    expect(outcome.rows).toEqual([]);
  });

  it('never touches the foreign, unchanged, skipped or unresolved parts of a plan', () => {
    const { transport, requests } = stubTransport([]);
    const outcome = execute({
      transport,
      plan: planWith({
        unchanged: ['p2'],
        skipped: ['p3'],
        unresolved: [proposal({ id: 'p4', issueKey: 'FIP-9' })],
        foreign: [
          {
            id: 'wf',
            issueId: '10100',
            authorAccountId: 'acc:other',
            from: new Date(2026, 7, 11, 13, 0),
            durationMs: HOUR,
            billableMs: 0,
            description: 'Someone else',
            attributes: {},
          },
        ],
      }),
    });

    expect(requests).toEqual([]);
    expect(outcome.rows).toEqual([]);
  });

  it('creates a worklog and returns the ledger entry that owns it', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 555 } }]);
    const entry = createOf();
    const outcome = execute({ transport, plan: planWith({ creates: [entry] }) });

    expect(requests[0]?.method).toBe('POST');
    expect(outcome.rows).toEqual([{ kind: 'create', proposalId: 'p1', status: 'written', tempoWorklogId: '555' }]);
    expect(outcome.ledger).toEqual([
      { proposalId: 'p1', tempoWorklogId: '555', contentHash: entry.contentHash, syncedAt: SYNCED_AT },
    ]);
    expect(outcome.retry).toEqual(emptyPlan());
  });

  it('marks the description when the instance offers no attribute to hold the id', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 555 } }]);

    execute({ transport, plan: planWith({ creates: [createOf()] }), marker: SUFFIX });

    expect((requests[0]?.body as { description?: string }).description).toBe('Logout on idle [et:p1]');
  });

  it('sends the marker attribute alongside the reviewer values', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 555 } }]);

    execute({
      transport,
      plan: planWith({ creates: [createOf()] }),
      marker: { kind: 'attribute', attributeKey: '_TimetrackId_' },
      attributesByProposalId: { p1: { _Category_: 'dev' } },
    });

    expect((requests[0]?.body as { attributes?: { key: string; value: unknown }[] }).attributes).toEqual([
      { key: '_Category_', value: 'dev' },
      { key: '_TimetrackId_', value: 'p1' },
    ]);
  });

  it('updates an owned worklog and refreshes its ledger hash', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: {} }]);
    const entry = updateOf();
    const outcome = execute({ transport, plan: planWith({ updates: [entry] }) });

    expect(requests[0]?.method).toBe('PUT');
    expect(outcome.ledger).toEqual([
      { proposalId: 'p1', tempoWorklogId: 'w1', contentHash: entry.contentHash, syncedAt: SYNCED_AT },
    ]);
  });

  it('deletes an owned worklog and prunes its ledger entry', () => {
    const { transport, requests } = stubTransport([{ status: 204, body: undefined }]);
    const outcome = execute({
      transport,
      plan: planWith({ deletes: [{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'proposal-rejected' }] }),
    });

    expect(requests[0]?.method).toBe('DELETE');
    expect(outcome.prunedProposalIds).toEqual(['p1']);
    expect(outcome.ledger).toEqual([]);
  });

  it('treats a worklog that is already gone as deleted', () => {
    const { transport } = stubTransport([{ status: 404, body: {} }]);
    const outcome = execute({
      transport,
      plan: planWith({ deletes: [{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'proposal-removed' }] }),
    });

    expect(outcome.rows[0]?.status).toBe('written');
    expect(outcome.retry.deletes).toEqual([]);
    expect(outcome.prunedProposalIds).toEqual(['p1']);
  });

  it('prunes the stale ledger entries the plan reported', () => {
    const { transport } = stubTransport([]);
    const outcome = execute({ transport, plan: planWith({ staleLedgerProposalIds: ['p7'] }) });

    expect(outcome.prunedProposalIds).toEqual(['p7']);
  });

  it('runs every delete before any create, so a moved worklog cannot be logged twice', () => {
    const { transport, requests } = stubTransport([
      { status: 204, body: undefined },
      { status: 200, body: { tempoWorklogId: 556 } },
    ]);
    const outcome = execute({
      transport,
      plan: planWith({
        deletes: [{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'issue-changed' }],
        creates: [{ ...createOf(), issueId: '10200', reason: 'recreated-after-issue-change' }],
      }),
    });

    expect(requests.map((request) => request.method)).toEqual(['DELETE', 'POST']);
    expect(outcome.ledger).toEqual([
      { proposalId: 'p1', tempoWorklogId: '556', contentHash: createOf().contentHash, syncedAt: SYNCED_AT },
    ]);
    expect(outcome.prunedProposalIds).toEqual([]);
  });

  it('does not create the replacement when the delete it replaces failed', () => {
    const { transport, requests } = stubTransport([{ status: 500, body: {} }]);
    const outcome = execute({
      transport,
      plan: planWith({
        deletes: [{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'issue-changed' }],
        creates: [{ ...createOf(), issueId: '10200', reason: 'recreated-after-issue-change' }],
      }),
    });

    expect(requests.map((request) => request.method)).toEqual(['DELETE']);
    expect(outcome.rows.map((row) => row.status)).toEqual(['failed', 'skipped']);
    expect(outcome.retry.deletes).toHaveLength(1);
    expect(outcome.retry.creates).toHaveLength(1);
  });

  it('blocks a row whose required attribute has no value instead of guessing one', () => {
    const { transport, requests } = stubTransport([]);
    const outcome = execute({
      transport,
      plan: planWith({ creates: [createOf()] }),
      workAttributes: [REQUIRED_CATEGORY],
    });

    expect(requests).toEqual([]);
    expect(outcome.rows[0]).toEqual({
      kind: 'create',
      proposalId: 'p1',
      status: 'blocked',
      missing: [REQUIRED_CATEGORY],
    });
    expect(outcome.ledger).toEqual([]);
    expect(outcome.retry.creates).toHaveLength(1);
  });

  it('writes the row once the required attribute has a value', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 555 } }]);
    const outcome = execute({
      transport,
      plan: planWith({ creates: [createOf()] }),
      workAttributes: [REQUIRED_CATEGORY],
      attributesByProposalId: { p1: { _Category_: 'dev' } },
    });

    expect(requests).toHaveLength(1);
    expect(outcome.rows[0]?.status).toBe('written');
  });

  it('reports one failing row without stopping the others', () => {
    const { transport } = stubTransport([
      { status: 500, body: { errors: ['boom'] } },
      { status: 200, body: { tempoWorklogId: 557 } },
    ]);
    const outcome = execute({
      transport,
      plan: planWith({ creates: [createOf(), createOf(proposal({ id: 'p2' }))] }),
    });

    expect(outcome.rows.map((row) => row.status)).toEqual(['failed', 'written']);
    expect(outcome.rows[0]?.error?.message).toContain('500');
    expect(outcome.ledger.map((entry) => entry.proposalId)).toEqual(['p2']);
  });

  it('hands back only the failed rows as a retryable plan', () => {
    const { transport } = stubTransport([
      { status: 500, body: {} },
      { status: 200, body: { tempoWorklogId: 557 } },
    ]);
    const first = createOf();
    const second = createOf(proposal({ id: 'p2' }));
    const outcome = execute({ transport, plan: planWith({ creates: [first, second] }) });

    expect(outcome.retry.creates).toEqual([first]);
  });

  it('lands the retried row on a second run', () => {
    const failing = stubTransport([{ status: 500, body: {} }]);
    const first = execute({ transport: failing.transport, plan: planWith({ creates: [createOf()] }) });

    const retrying = stubTransport([{ status: 200, body: { tempoWorklogId: 558 } }]);
    const second = execute({ transport: retrying.transport, plan: first.retry });

    expect(second.rows.map((row) => row.status)).toEqual(['written']);
    expect(second.ledger[0]?.tempoWorklogId).toBe('558');
    expect(second.retry).toEqual(emptyPlan());
  });

  it('never both stores and prunes the same proposal', () => {
    const { transport } = stubTransport([
      { status: 204, body: undefined },
      { status: 200, body: { tempoWorklogId: 559 } },
    ]);
    const outcome = execute({
      transport,
      plan: planWith({
        deletes: [{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'issue-changed' }],
        creates: [{ ...createOf(), reason: 'recreated-after-issue-change' }],
      }),
    });

    const stored = new Set(outcome.ledger.map((entry) => entry.proposalId));

    expect(outcome.prunedProposalIds.filter((id) => stored.has(id))).toEqual([]);
  });
});
