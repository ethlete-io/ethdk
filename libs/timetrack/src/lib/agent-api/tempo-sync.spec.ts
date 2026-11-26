import { describe, expect, it } from 'vitest';
import { WorklogProposal } from '../model/proposal';
import { TempoSyncPlan } from '../tempo/diff';
import { TempoSyncPreview } from '../tempo/preview';
import {
  tempoSyncPlanHash,
  tempoSyncWriteRefusal,
  toAgentApiTempoSyncPlan,
  toAgentApiTempoSyncRun,
} from './tempo-sync';

const HOUR = 3_600_000;

const proposal = (overrides: Partial<WorklogProposal> = {}): WorklogProposal => ({
  id: 'p1',
  issueKey: 'FIP-3010',
  from: new Date(2026, 8, 7, 9, 0),
  to: new Date(2026, 8, 7, 10, 0),
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
  foreignSubtractions: [],
});

const preview = (plan: Partial<TempoSyncPlan>): TempoSyncPreview => ({
  plan: { ...emptyPlan(), ...plan },
  account: { accountId: 'me', displayName: 'Me' } as TempoSyncPreview['account'],
  remote: [
    {
      id: '71',
      issueId: '10',
      authorAccountId: 'me',
      from: new Date(2026, 8, 7, 11, 0),
      durationMs: HOUR / 2,
      billableMs: HOUR / 2,
      description: 'Old row',
      attributes: {},
    },
  ],
  keysByIssueId: new Map([['10', 'FIP-1']]),
  coverage: { day: '2026-09-07', observedAt: new Date(), issues: [] } as unknown as TempoSyncPreview['coverage'],
});

const planOf = (plan: Partial<TempoSyncPlan>) => toAgentApiTempoSyncPlan({ day: '2026-09-07', preview: preview(plan) });

describe('toAgentApiTempoSyncPlan', () => {
  it('names a delete by the worklog Tempo holds, and holds back a write with no description', () => {
    const answer = planOf({
      deletes: [{ proposalId: 'gone', tempoWorklogId: '71', reason: 'proposal-removed' }],
      creates: [{ proposal: proposal({ description: ' ' }), issueId: '20', contentHash: 'x', reason: 'new' }],
      unresolved: [proposal({ id: 'p2', issueKey: 'NOPE-1' }), proposal({ id: 'p3', issueKey: 'NOPE-1' })],
    });

    expect(answer.writes).toEqual([
      expect.objectContaining({ kind: 'delete', issueKey: 'FIP-1', durationMs: HOUR / 2, tempoWorklogId: '71' }),
      expect.objectContaining({
        kind: 'create',
        issueKey: 'FIP-3010',
        blocked: expect.stringContaining('description'),
      }),
    ]);
    expect(answer.unresolvedKeys).toEqual(['NOPE-1']);
    expect(answer.planHash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('tempoSyncPlanHash', () => {
  const create = planOf({ creates: [{ proposal: proposal(), issueId: '20', contentHash: 'x', reason: 'new' }] });

  it('does not depend on the order the writes are listed in', () => {
    const writes = planOf({
      deletes: [{ proposalId: 'gone', tempoWorklogId: '71', reason: 'proposal-removed' }],
      creates: [{ proposal: proposal(), issueId: '20', contentHash: 'x', reason: 'new' }],
    }).writes;

    expect(tempoSyncPlanHash([...writes].reverse())).toBe(tempoSyncPlanHash(writes));
  });

  it('changes with the description, the start, the duration and the target worklog', () => {
    const [write] = create.writes;

    if (!write) throw new Error('no write');

    const variants = [
      { ...write, description: 'Other' },
      { ...write, fromMs: write.fromMs + 60_000 },
      { ...write, durationMs: write.durationMs + 60_000 },
      { ...write, tempoWorklogId: '99' },
      { ...write, issueKey: 'FIP-1' },
    ];

    variants.forEach((variant) => expect(tempoSyncPlanHash([variant])).not.toBe(create.planHash));
  });

  it('ignores why a write is planned', () => {
    const [write] = create.writes;

    if (!write) throw new Error('no write');

    expect(tempoSyncPlanHash([{ ...write, reason: 'recreated-after-remote-delete' }])).toBe(create.planHash);
  });
});

describe('tempoSyncWriteRefusal', () => {
  const plan = planOf({ creates: [{ proposal: proposal(), issueId: '20', contentHash: 'x', reason: 'new' }] });

  it('refuses a hash the fresh plan does not have', () => {
    expect(tempoSyncWriteRefusal({ plan, planHash: 'deadbeef' })).toContain(`is ${plan.planHash} now, not deadbeef`);
  });

  it('refuses a plan with nothing to write, whatever hash it is given', () => {
    const empty = planOf({});

    expect(tempoSyncWriteRefusal({ plan: empty, planHash: empty.planHash })).toContain('nothing to write');
  });

  it('lets the confirmed plan through', () => {
    expect(tempoSyncWriteRefusal({ plan, planHash: plan.planHash })).toBeNull();
  });
});

describe('toAgentApiTempoSyncRun', () => {
  it('names each row by its issue, and counts what did not land', () => {
    const plan = planOf({ creates: [{ proposal: proposal(), issueId: '20', contentHash: 'x', reason: 'new' }] });
    const run = toAgentApiTempoSyncRun({
      plan,
      unrecorded: null,
      outcome: {
        rows: [{ kind: 'create', proposalId: 'p1', status: 'failed', error: new Error('Tempo said no') }],
        ledger: [],
        prunedProposalIds: [],
        retry: { ...emptyPlan(), creates: [{ proposal: proposal(), issueId: '20', contentHash: 'x', reason: 'new' }] },
      },
    });

    expect(run).toEqual({
      rows: [{ kind: 'create', proposalId: 'p1', status: 'failed', issueKey: 'FIP-3010', detail: 'Tempo said no' }],
      retryCount: 1,
    });
  });
});
