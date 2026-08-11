import { describe, expect, it } from 'vitest';
import { SyncedWorklog, WorklogProposal } from '../model/proposal';
import { contentHashOf, planTempoSync } from './diff';
import { TempoWorklog } from './worklogs';

const HOUR = 3_600_000;
const IDS = new Map([['FIP-3010', '10100']]);

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

const remoteFor = (target: WorklogProposal, overrides: Partial<TempoWorklog> = {}): TempoWorklog => ({
  id: 'w1',
  issueId: '10100',
  authorAccountId: 'acc:123',
  from: target.from,
  durationMs: target.durationMs,
  billableMs: 0,
  description: target.description,
  attributes: {},
  ...overrides,
});

const ledgerFor = (target: WorklogProposal, overrides: Partial<SyncedWorklog> = {}): SyncedWorklog => ({
  proposalId: target.id,
  tempoWorklogId: 'w1',
  contentHash: contentHashOf({ proposal: target }),
  syncedAt: new Date(2026, 7, 11, 18, 0),
  ...overrides,
});

const plan = (options: {
  proposals?: WorklogProposal[];
  ledger?: SyncedWorklog[];
  remote?: TempoWorklog[];
  ids?: Map<string, string>;
}) =>
  planTempoSync({
    proposals: options.proposals ?? [],
    ledger: options.ledger ?? [],
    remote: options.remote ?? [],
    issueIdsByKey: options.ids ?? IDS,
  });

describe('contentHashOf', () => {
  it('is stable for the same content', () => {
    expect(contentHashOf({ proposal: proposal() })).toBe(contentHashOf({ proposal: proposal() }));
  });

  it.each([
    ['issue', { issueKey: 'FIP-4000' }],
    ['start', { from: new Date(2026, 7, 11, 10, 0) }],
    ['duration', { durationMs: 2 * HOUR }],
    ['description', { description: 'Something else' }],
  ])('changes when the %s changes', (_, overrides) => {
    expect(contentHashOf({ proposal: proposal(overrides) })).not.toBe(contentHashOf({ proposal: proposal() }));
  });

  it('covers attribute values, and does not depend on the order they are given in', () => {
    const one = contentHashOf({ proposal: proposal(), attributes: { _Billable_: true, _Category_: 'Dev' } });
    const other = contentHashOf({ proposal: proposal(), attributes: { _Category_: 'Dev', _Billable_: true } });

    expect(one).toBe(other);
    expect(one).not.toBe(contentHashOf({ proposal: proposal(), attributes: { _Billable_: false, _Category_: 'Dev' } }));
  });
});

describe('planTempoSync', () => {
  it('creates a worklog for an accepted proposal tempo has never seen', () => {
    const target = proposal();
    const result = plan({ proposals: [target] });

    expect(result.creates).toEqual([
      { proposal: target, issueId: '10100', contentHash: contentHashOf({ proposal: target }), reason: 'new' },
    ]);
    expect(result.updates).toEqual([]);
    expect(result.deletes).toEqual([]);
  });

  it('writes nothing for a proposal tempo already holds exactly', () => {
    const target = proposal();
    const result = plan({ proposals: [target], ledger: [ledgerFor(target)], remote: [remoteFor(target)] });

    expect(result.unchanged).toEqual(['p1']);
    expect(result.creates).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  it('updates a worklog whose proposal was edited after it was synced', () => {
    const synced = proposal();
    const edited = proposal({ durationMs: 2 * HOUR, state: 'edited' });
    const result = plan({ proposals: [edited], ledger: [ledgerFor(synced)], remote: [remoteFor(synced)] });

    expect(result.updates).toEqual([
      {
        proposal: edited,
        issueId: '10100',
        tempoWorklogId: 'w1',
        contentHash: contentHashOf({ proposal: edited }),
        reason: 'content-changed',
      },
    ]);
  });

  it('updates a worklog someone changed in tempo behind the app', () => {
    const target = proposal();
    const result = plan({
      proposals: [target],
      ledger: [ledgerFor(target)],
      remote: [remoteFor(target, { durationMs: 4 * HOUR })],
    });

    expect(result.updates.map((entry) => entry.reason)).toEqual(['changed-in-tempo']);
  });

  it('recreates a worklog that was deleted in tempo', () => {
    const target = proposal();
    const result = plan({ proposals: [target], ledger: [ledgerFor(target)], remote: [] });

    expect(result.creates.map((entry) => entry.reason)).toEqual(['recreated-after-remote-delete']);
    expect(result.staleLedgerProposalIds).toEqual([]);
  });

  it('deletes the worklog of a rejected proposal', () => {
    const target = proposal({ state: 'rejected' });
    const result = plan({ proposals: [target], ledger: [ledgerFor(target)], remote: [remoteFor(target)] });

    expect(result.deletes).toEqual([{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'proposal-rejected' }]);
  });

  it('deletes the worklog of a proposal the day no longer produces', () => {
    const gone = proposal();
    const result = plan({ proposals: [], ledger: [ledgerFor(gone)], remote: [remoteFor(gone)] });

    expect(result.deletes).toEqual([{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'proposal-removed' }]);
  });

  it('deletes the worklog of a proposal foreign time has fully accounted for', () => {
    const target = proposal({ durationMs: 0 });
    const result = plan({ proposals: [target], ledger: [ledgerFor(target)], remote: [remoteFor(target)] });

    expect(result.deletes).toEqual([{ proposalId: 'p1', tempoWorklogId: 'w1', reason: 'no-time-left' }]);
  });

  it('reports a ledger entry with nothing left on either side as stale', () => {
    const gone = proposal();
    const result = plan({ proposals: [], ledger: [ledgerFor(gone)], remote: [] });

    expect(result.deletes).toEqual([]);
    expect(result.staleLedgerProposalIds).toEqual(['p1']);
  });

  it('leaves an unreviewed proposal alone rather than syncing or deleting it', () => {
    const target = proposal({ state: 'suggested' });
    const result = plan({ proposals: [target], ledger: [ledgerFor(target)], remote: [remoteFor(target)] });

    expect(result.skipped).toEqual(['p1']);
    expect(result.creates).toEqual([]);
    expect(result.deletes).toEqual([]);
  });

  it('never touches a worklog no ledger entry points at, however much it looks like ours', () => {
    const target = proposal();
    const foreign = remoteFor(target, { id: 'w-foreign' });
    const result = plan({ proposals: [target], remote: [foreign] });

    expect(result.foreign).toEqual([foreign]);
    expect(result.deletes).toEqual([]);
    expect(result.creates.map((entry) => entry.reason)).toEqual(['new']);
  });

  it('reports a proposal whose key resolved to no jira id instead of writing without one', () => {
    const target = proposal({ issueKey: 'FIP-0000' });
    const result = plan({ proposals: [target] });

    expect(result.unresolved).toEqual([target]);
    expect(result.creates).toEqual([]);
  });
});
